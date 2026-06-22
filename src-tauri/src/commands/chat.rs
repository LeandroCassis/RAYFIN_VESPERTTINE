//! Chat engine: drives the GitHub Copilot CLI as the app's AI agent and maps its
//! JSONL event stream (`-p --output-format json`) into clean ChatEvents for the
//! renderer. Faithful Rust port of `src/main/services/chat.ts`.
//!
//! One-shot per turn: `copilot -p <text> --output-format json --session-id <uuid>
//! -C <cwd> [--model M] [--effort E] [--attachment A]* --allow-all --no-color`.
//! Reusing the same `--session-id` across turns preserves conversation context, so
//! each project (and side thread) keeps one persistent session id.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::commands::screenshot;
use crate::services::emit::emit_chat_event;
use crate::services::exec::{run, OnData, RunOptions, Stream};
use crate::services::history::{self, MAIN_THREAD_ID};
use crate::services::store;
use crate::state::AppState;
use crate::types::{ChatEvent, ChatMessage, ChatOptions, ChatToolCall, ChatToolState, ChatTurnResult};

const MAX_TOOL_OUTPUT: usize = 4000;
/// Up to this many copilot invocations per turn on a transient pre-work failure.
const MAX_ATTEMPTS: u32 = 3;
/// 20 minute per-turn timeout (matches chat.ts).
const TURN_TIMEOUT_MS: u64 = 20 * 60_000;

/// Stderr signatures that indicate a transient, safe-to-retry failure.
static TRANSIENT_RE: Lazy<Regex> = Lazy::new(|| {
  Regex::new(
    r"(?i)rate.?limit|too many requests|temporar|timeout|etimedout|econnreset|enotfound|socket hang up|network error|503|502|500|overloaded|service unavailable|try again",
  )
  .unwrap()
});

/// A `rayfin up` invocation inside a tool call marks the turn as a deploy.
static RAYFIN_UP_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\brayfin\s+up\b").unwrap());

fn thread_opt(thread_id: &Option<String>) -> Option<&str> {
  thread_id.as_deref()
}

fn truncate(text: &str, max: usize) -> String {
  if text.chars().count() <= max {
    return text.to_string();
  }
  let head: String = text.chars().take(max).collect();
  let more = text.chars().count() - max;
  format!("{head}\n… ({more} more characters)")
}

/// Derive a one-line summary for a tool call from its arguments.
fn tool_title(tool_name: &str, args: Option<&Value>) -> String {
  let Some(args) = args else {
    return tool_name.to_string();
  };
  let raw = args
    .get("description")
    .and_then(|v| v.as_str())
    .or_else(|| args.get("command").and_then(|v| v.as_str()))
    .or_else(|| args.get("path").and_then(|v| v.as_str()))
    .unwrap_or(tool_name);
  let collapsed = raw.split_whitespace().collect::<Vec<_>>().join(" ");
  truncate(collapsed.trim(), 200)
}

/// Per-attempt accumulator for a single turn.
struct TurnCtx {
  files_modified: Vec<String>,
  ran_deploy: bool,
  saw_result: bool,
  /// True once any assistant text or tool call occurred (blocks unsafe retries).
  saw_activity: bool,
  /// Characters of each assistant message already streamed as deltas (dedup).
  streamed: HashMap<String, usize>,
}

impl TurnCtx {
  fn new() -> Self {
    TurnCtx {
      files_modified: vec![],
      ran_deploy: false,
      saw_result: false,
      saw_activity: false,
      streamed: HashMap::new(),
    }
  }
}

/// Shared, mutex-guarded state the streaming callback mutates across chunks.
struct StreamState {
  buffer: String,
  ctx: TurnCtx,
}

/// Parse one JSONL line and dispatch it (ignores blank / non-JSON lines).
fn flush_line(line: &str, sink: &mut dyn FnMut(ChatEvent), ctx: &mut TurnCtx) {
  let trimmed = line.trim();
  if trimmed.is_empty() {
    return;
  }
  if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
    handle_event(&value, sink, ctx);
  }
}

/// Map a single parsed Copilot JSON event to ChatEvents, pushed into `sink`.
fn handle_event(raw: &Value, sink: &mut dyn FnMut(ChatEvent), ctx: &mut TurnCtx) {
  let Some(kind) = raw.get("type").and_then(|v| v.as_str()) else {
    return;
  };
  let empty = Value::Object(serde_json::Map::new());
  let data = raw.get("data").filter(|d| d.is_object()).unwrap_or(&empty);

  match kind {
    "assistant.message_delta" => {
      let id = data.get("messageId").and_then(|v| v.as_str()).unwrap_or("").to_string();
      let text = data.get("deltaContent").and_then(|v| v.as_str()).unwrap_or("");
      if text.is_empty() {
        return;
      }
      ctx.saw_activity = true;
      *ctx.streamed.entry(id).or_insert(0) += text.chars().count();
      sink(ChatEvent::Delta { text: text.to_string() });
    }
    "assistant.message" => {
      let id = data.get("messageId").and_then(|v| v.as_str()).unwrap_or("").to_string();
      let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
      let total = content.chars().count();
      let have = *ctx.streamed.get(&id).unwrap_or(&0);
      if total > have {
        let rest: String = content.chars().skip(have).collect();
        sink(ChatEvent::Delta { text: rest });
        ctx.streamed.insert(id, total);
      }
    }
    "tool.execution_start" => {
      let tool_name = data.get("toolName").and_then(|v| v.as_str()).unwrap_or("tool").to_string();
      let args = data.get("arguments");
      let title = tool_title(&tool_name, args);
      let command = args.and_then(|a| a.get("command")).and_then(|v| v.as_str()).unwrap_or("");
      if RAYFIN_UP_RE.is_match(command) {
        ctx.ran_deploy = true;
      }
      ctx.saw_activity = true;
      let id = data
        .get("toolCallId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
      sink(ChatEvent::ToolStart {
        tool: ChatToolCall {
          id,
          name: tool_name,
          title,
          state: ChatToolState::Running,
          output: None,
        },
      });
    }
    "tool.execution_complete" => {
      let id = data.get("toolCallId").and_then(|v| v.as_str()).unwrap_or("").to_string();
      let success = data.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
      let output = data
        .get("result")
        .and_then(|r| r.get("content"))
        .and_then(|v| v.as_str())
        .map(|c| truncate(c, MAX_TOOL_OUTPUT));
      sink(ChatEvent::ToolEnd {
        id,
        state: if success { ChatToolState::Success } else { ChatToolState::Error },
        output,
      });
    }
    "result" => {
      ctx.saw_result = true;
      if let Some(files) = raw
        .get("usage")
        .and_then(|u| u.get("codeChanges"))
        .and_then(|c| c.get("filesModified"))
        .and_then(|f| f.as_array())
      {
        ctx.files_modified = files.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
      }
    }
    _ => {}
  }
}

struct ThreadContext {
  cwd: String,
  session_id: String,
}

/// Resolve the working dir + Copilot session id for a thread, creating and
/// persisting a session id on first use. Returns None when the project/thread is
/// gone. Model/effort stay project-level (shared across threads).
fn resolve_context(project_id: &str, thread_id: &str) -> Option<ThreadContext> {
  let project = store::find_project(project_id)?;

  if thread_id == MAIN_THREAD_ID {
    let session_id = match project.copilot_session_id {
      Some(s) => s,
      None => {
        let sid = Uuid::new_v4().to_string();
        let stored = sid.clone();
        store::mutate_project(project_id, move |p| p.copilot_session_id = Some(stored));
        sid
      }
    };
    return Some(ThreadContext { cwd: project.path, session_id });
  }

  let thread = project.threads.as_ref()?.iter().find(|t| t.id == thread_id)?;
  let cwd = thread.worktree_path.clone();
  let session_id = match thread.copilot_session_id.clone() {
    Some(s) => s,
    None => {
      let sid = Uuid::new_v4().to_string();
      let stored = sid.clone();
      let target = thread_id.to_string();
      store::mutate_project(project_id, move |p| {
        if let Some(threads) = p.threads.as_mut() {
          if let Some(t) = threads.iter_mut().find(|t| t.id == target) {
            t.copilot_session_id = Some(stored);
          }
        }
      });
      sid
    }
  };
  Some(ThreadContext { cwd, session_id })
}

#[tauri::command]
pub async fn chat_send(
  app: AppHandle,
  state: State<'_, AppState>,
  project_id: String,
  turn_id: String,
  text: String,
  attachments: Option<Vec<String>>,
  thread_id: Option<String>,
) -> Result<ChatTurnResult, String> {
  run_turn(app, state.inner(), project_id, turn_id, text, attachments, thread_id).await
}

/// The turn engine shared by `chat_send` and the side-thread merge flow. Drives
/// one Copilot invocation and streams its events to `(project_id, thread, turn_id)`.
/// Always resolves to `Ok` — failures surface inside the [`ChatTurnResult`].
pub(crate) async fn run_turn(
  app: AppHandle,
  state: &AppState,
  project_id: String,
  turn_id: String,
  text: String,
  attachments: Option<Vec<String>>,
  thread_id: Option<String>,
) -> Result<ChatTurnResult, String> {
  let thread = thread_id.clone().unwrap_or_else(|| MAIN_THREAD_ID.to_string());
  let attachments = attachments.unwrap_or_default();

  let Some(project) = store::find_project(&project_id) else {
    emit_chat_event(&app, &project_id, &thread, &turn_id, ChatEvent::Error { text: "Project not found.".into() });
    screenshot::cleanup(&attachments);
    return Ok(ChatTurnResult {
      ok: false,
      error: Some("Project not found.".into()),
      files_modified: vec![],
      ran_deploy: false,
    });
  };

  let Some(ctx_info) = resolve_context(&project_id, &thread) else {
    emit_chat_event(&app, &project_id, &thread, &turn_id, ChatEvent::Error { text: "Side thread not found.".into() });
    screenshot::cleanup(&attachments);
    return Ok(ChatTurnResult {
      ok: false,
      error: Some("Thread not found.".into()),
      files_modified: vec![],
      ran_deploy: false,
    });
  };

  // Guard against two concurrent turns on the same project/thread.
  let Some(token) = state.try_begin_chat(&project_id, thread_opt(&thread_id)) else {
    emit_chat_event(
      &app,
      &project_id,
      &thread,
      &turn_id,
      ChatEvent::Error { text: "A message is already being processed for this thread.".into() },
    );
    return Ok(ChatTurnResult {
      ok: false,
      error: Some("Turn already running.".into()),
      files_modified: vec![],
      ran_deploy: false,
    });
  };

  let mut args: Vec<String> = vec![
    "-p".into(),
    text.clone(),
    "--output-format".into(),
    "json".into(),
    "--session-id".into(),
    ctx_info.session_id.clone(),
    "-C".into(),
    ctx_info.cwd.clone(),
  ];
  if let Some(m) = project.model.as_deref() {
    if !m.is_empty() && m != "auto" {
      args.push("--model".into());
      args.push(m.into());
    }
  }
  if let Some(e) = project.effort.as_deref() {
    if !e.is_empty() {
      args.push("--effort".into());
      args.push(e.into());
    }
  }
  for a in &attachments {
    args.push("--attachment".into());
    args.push(a.clone());
  }
  args.push("--allow-all".into());
  args.push("--no-color".into());
  let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
  let cwd_pb = PathBuf::from(&ctx_info.cwd);

  // Shared streaming state + the callback that parses the JSONL stdout stream.
  let shared = Arc::new(Mutex::new(StreamState { buffer: String::new(), ctx: TurnCtx::new() }));
  let on_data: OnData = {
    let shared = shared.clone();
    let app = app.clone();
    let pid = project_id.clone();
    let tid = thread.clone();
    let turn = turn_id.clone();
    Arc::new(move |stream: Stream, chunk: &str| {
      if !matches!(stream, Stream::Stdout) {
        return;
      }
      let mut st = shared.lock().unwrap();
      st.buffer.push_str(chunk);
      let mut sink = |ev: ChatEvent| emit_chat_event(&app, &pid, &tid, &turn, ev);
      while let Some(nl) = st.buffer.find('\n') {
        let line = st.buffer[..nl].to_string();
        st.buffer.replace_range(..=nl, "");
        flush_line(&line, &mut sink, &mut st.ctx);
      }
    })
  };

  let mut result;
  let mut attempt: u32 = 1;
  loop {
    if attempt > 1 {
      let mut st = shared.lock().unwrap();
      st.ctx = TurnCtx::new();
      st.buffer.clear();
    }

    result = run(
      "copilot",
      &arg_refs,
      RunOptions {
        cwd: Some(cwd_pb.clone()),
        env: vec![],
        on_data: Some(on_data.clone()),
        timeout_ms: Some(TURN_TIMEOUT_MS),
        cancel: Some(token.clone()),
      },
    )
    .await;

    // Flush any trailing partial line left in the buffer.
    {
      let mut st = shared.lock().unwrap();
      if !st.buffer.is_empty() {
        let line = std::mem::take(&mut st.buffer);
        let mut sink = |ev: ChatEvent| emit_chat_event(&app, &project_id, &thread, &turn_id, ev);
        flush_line(&line, &mut sink, &mut st.ctx);
      }
    }

    if attempt >= MAX_ATTEMPTS {
      break;
    }

    // Retry only when nothing happened yet (no output, tools, or result) and the
    // failure looks transient — re-running the same prompt is then side-effect free.
    let (saw_result, saw_activity) = {
      let st = shared.lock().unwrap();
      (st.ctx.saw_result, st.ctx.saw_activity)
    };
    let retryable = !result.not_found
      && !result.ok
      && !saw_result
      && !saw_activity
      && !token.is_cancelled()
      && TRANSIENT_RE.is_match(&result.stderr);
    if !retryable {
      break;
    }
    emit_chat_event(
      &app,
      &project_id,
      &thread,
      &turn_id,
      ChatEvent::Notice { text: format!("Copilot CLI hiccup — retrying ({}/{})…", attempt, MAX_ATTEMPTS - 1) },
    );
    tokio::time::sleep(Duration::from_millis(attempt as u64 * 1000)).await;
    attempt += 1;
  }

  let (files_modified, ran_deploy, saw_result) = {
    let st = shared.lock().unwrap();
    (st.ctx.files_modified.clone(), st.ctx.ran_deploy, st.ctx.saw_result)
  };

  screenshot::cleanup(&attachments);
  state.end_chat(&project_id, thread_opt(&thread_id));

  if result.not_found {
    emit_chat_event(&app, &project_id, &thread, &turn_id, ChatEvent::Error { text: "The copilot CLI was not found on PATH.".into() });
    return Ok(ChatTurnResult {
      ok: false,
      error: Some("copilot not found".into()),
      files_modified: vec![],
      ran_deploy,
    });
  }

  let ok = result.ok && saw_result;
  if !ok && !saw_result {
    let detail = if !result.stderr.trim().is_empty() {
      result.stderr.trim().to_string()
    } else {
      format!(
        "copilot exited with code {}",
        result.exit_code.map(|c| c.to_string()).unwrap_or_else(|| "unknown".into())
      )
    };
    emit_chat_event(&app, &project_id, &thread, &turn_id, ChatEvent::Error { text: detail });
  }

  emit_chat_event(
    &app,
    &project_id,
    &thread,
    &turn_id,
    ChatEvent::Result { ok, files_modified: files_modified.clone(), ran_deploy },
  );
  Ok(ChatTurnResult {
    ok,
    error: if ok { None } else { Some("Turn failed.".into()) },
    files_modified,
    ran_deploy,
  })
}

#[tauri::command]
pub fn chat_cancel(state: State<'_, AppState>, project_id: String, thread_id: Option<String>) {
  state.cancel_chat(&project_id, thread_opt(&thread_id));
}

#[tauri::command]
pub fn chat_reset(state: State<'_, AppState>, project_id: String, thread_id: Option<String>) {
  let tid = thread_opt(&thread_id);
  // Stop any in-flight turn first (mirrors chat.ts resetSession → cancelMessage).
  state.cancel_chat(&project_id, tid);
  history::clear_history(&project_id, tid);
  match tid {
    None | Some(MAIN_THREAD_ID) => {
      store::mutate_project(&project_id, |p| p.copilot_session_id = None);
    }
    Some(tid) => {
      store::mutate_project(&project_id, |p| {
        if let Some(threads) = p.threads.as_mut() {
          if let Some(t) = threads.iter_mut().find(|t| t.id == tid) {
            t.copilot_session_id = None;
          }
        }
      });
    }
  }
}

#[tauri::command]
pub fn chat_history(project_id: String, thread_id: Option<String>) -> Vec<ChatMessage> {
  history::load_history(&project_id, thread_opt(&thread_id))
}

#[tauri::command]
pub fn chat_save_history(project_id: String, messages: Vec<ChatMessage>, thread_id: Option<String>) {
  history::save_history(&project_id, messages, thread_opt(&thread_id));
}

#[tauri::command]
pub fn chat_set_options(project_id: String, options: ChatOptions) {
  let model = options.model.as_deref().map(str::trim).filter(|m| !m.is_empty()).map(|m| m.to_string());
  store::mutate_project(&project_id, |p| {
    p.model = model;
    p.effort = options.effort.clone();
  });
}

#[cfg(test)]
mod tests {
  use super::*;

  fn collect(lines: &[&str], ctx: &mut TurnCtx) -> Vec<ChatEvent> {
    let mut events = vec![];
    let mut sink = |e: ChatEvent| events.push(e);
    for l in lines {
      flush_line(l, &mut sink, ctx);
    }
    events
  }

  #[test]
  fn delta_then_result_sets_files_and_flags() {
    let mut ctx = TurnCtx::new();
    let events = collect(
      &[
        r#"{"type":"assistant.message_delta","data":{"messageId":"m1","deltaContent":"Hello"}}"#,
        r#"{"type":"result","usage":{"codeChanges":{"filesModified":["a.ts","b.ts"]}}}"#,
      ],
      &mut ctx,
    );
    assert!(ctx.saw_activity);
    assert!(ctx.saw_result);
    assert_eq!(ctx.files_modified, vec!["a.ts".to_string(), "b.ts".to_string()]);
    assert_eq!(events.len(), 1);
    match &events[0] {
      ChatEvent::Delta { text } => assert_eq!(text, "Hello"),
      _ => panic!("expected delta"),
    }
  }

  #[test]
  fn assistant_message_only_emits_untyped_remainder() {
    let mut ctx = TurnCtx::new();
    // 5 chars already streamed as a delta; the full message adds " world".
    let events = collect(
      &[
        r#"{"type":"assistant.message_delta","data":{"messageId":"m1","deltaContent":"Hello"}}"#,
        r#"{"type":"assistant.message","data":{"messageId":"m1","content":"Hello world"}}"#,
      ],
      &mut ctx,
    );
    assert_eq!(events.len(), 2);
    match &events[1] {
      ChatEvent::Delta { text } => assert_eq!(text, " world"),
      _ => panic!("expected remainder delta"),
    }
  }

  #[test]
  fn tool_start_detects_deploy_and_titles() {
    let mut ctx = TurnCtx::new();
    let events = collect(
      &[r#"{"type":"tool.execution_start","data":{"toolCallId":"t1","toolName":"shell","arguments":{"command":"npx rayfin up --json"}}}"#],
      &mut ctx,
    );
    assert!(ctx.ran_deploy);
    assert!(ctx.saw_activity);
    match &events[0] {
      ChatEvent::ToolStart { tool } => {
        assert_eq!(tool.id, "t1");
        assert_eq!(tool.name, "shell");
        assert_eq!(tool.title, "npx rayfin up --json");
        assert!(matches!(tool.state, ChatToolState::Running));
      }
      _ => panic!("expected tool-start"),
    }
  }

  #[test]
  fn tool_complete_maps_success_and_output() {
    let mut ctx = TurnCtx::new();
    let events = collect(
      &[r#"{"type":"tool.execution_complete","data":{"toolCallId":"t1","success":true,"result":{"content":"done"}}}"#],
      &mut ctx,
    );
    match &events[0] {
      ChatEvent::ToolEnd { id, state, output } => {
        assert_eq!(id, "t1");
        assert!(matches!(state, ChatToolState::Success));
        assert_eq!(output.as_deref(), Some("done"));
      }
      _ => panic!("expected tool-end"),
    }
  }

  #[test]
  fn non_json_and_blank_lines_are_ignored() {
    let mut ctx = TurnCtx::new();
    let events = collect(&["", "   ", "not json at all", "{bad"], &mut ctx);
    assert!(events.is_empty());
    assert!(!ctx.saw_activity);
  }

  #[test]
  fn truncate_appends_more_marker() {
    assert_eq!(truncate("hello", 10), "hello");
    let out = truncate("abcdef", 3);
    assert!(out.starts_with("abc"));
    assert!(out.contains("3 more characters"));
  }
}

