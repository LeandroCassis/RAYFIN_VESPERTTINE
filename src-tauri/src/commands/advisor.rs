//! Advisor: a Copilot-driven, read-only security review of the active Rayfin
//! app. Drives the same Copilot CLI path as chat (`copilot -p <prompt>
//! --output-format json -C <cwd> ...`) but with an *ephemeral* session id so the
//! review never lands in the project's Build chat history. The model is asked to
//! emit a single fenced JSON report which we parse into [`AdvisorReport`].
//!
//! For now the review covers two checks: data/routes not behind authentication
//! (`category: "auth"`) and overly permissive database policies
//! (`category: "policy"`). The `category` field drives grouping in the UI, so new
//! checks can be added later by extending the prompt alone.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde_json::Value;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::services::emit::emit_advisor_event;
use crate::services::exec::{run, OnData, RunOptions, Stream};
use crate::services::store;
use crate::state::AppState;
use crate::types::{AdvisorEvent, AdvisorRawReport, AdvisorReport};

/// 10 minute ceiling for a single review run.
const RUN_TIMEOUT_MS: u64 = 10 * 60_000;

/// The full instruction handed to Copilot. Read-only; ends with a strict JSON
/// contract we can parse out of the assistant's final message.
const ADVISOR_PROMPT: &str = r#"You are a security reviewer for a Rayfin app (a Microsoft Fabric app: a TypeScript frontend under `src/` plus a Rayfin backend defined under `rayfin/`). Perform a READ-ONLY review of the app in this directory. DO NOT modify, create, or delete any files, and DO NOT run any deploy or `rayfin up` command.

Review for exactly these two categories of issues:

1) category "auth" — data or routes not behind authentication:
   - Rayfin data entities (in `rayfin/data/schema.ts` and any files it imports) that are MISSING an explicit permission decorator. An entity without one silently defaults to `authenticated: *` (full CRUD for ANY signed-in user). Flag each such entity.
   - Entities decorated `@anonymous` (reachable without signing in) — especially when writable or holding non-public data.
   - Frontend pages/routes (in `src/`, e.g. React Router routes or pages reached from `App.tsx` / `src/pages`) that render protected content WITHOUT an auth guard (no check for a signed-in session before rendering).

2) category "policy" — database policies too permissive:
   - Entities granting broad CRUD on user-scoped data WITHOUT a row-level `policy: (claims, item) => claims.sub.eq(item.user_id)` (or equivalent), so any signed-in user can read or modify other users' rows.
   - `@authenticated` or `@role` grants that are broader than the data warrants.
   - Sensitive fields exposed to clients that should be hidden via `exclude: [...]`.

Use the `rayfin` MCP tools or `rayfin docs ...` if you need to confirm decorator or policy semantics. Read `rayfin/rayfin.yml`, `rayfin/data/schema.ts`, and the frontend routing under `src/`. Only report real issues you verified by reading the code — do not invent problems.

Severity guidance: "high" = unauthenticated/public access to data, or one user able to reach another user's data; "medium" = overly broad authenticated access; "low" = minor hardening.

When you are done, the FINAL thing in your reply must be a single fenced ```json code block (and nothing after it) exactly matching this schema:

```json
{
  "summary": "<one or two sentence plain-language overview of what you found>",
  "findings": [
    {
      "id": "<short-kebab-slug>",
      "category": "auth",
      "severity": "high",
      "title": "<short title>",
      "detail": "<what is wrong and why it matters, 1-3 sentences>",
      "file": "<project-relative path, or null if not file-specific>",
      "recommendation": "<a concrete fix>"
    }
  ]
}
```

If you find no issues, return an empty "findings" array and a reassuring "summary"."#;

/// Per-run streaming accumulator.
#[derive(Default)]
struct ReviewState {
  /// Partial line carried across stdout chunks.
  buffer: String,
  /// Full assistant text, reassembled in stream order (for JSON extraction).
  assistant: String,
  /// Characters of each assistant message already appended (dedup with the
  /// terminal `assistant.message` event).
  streamed: HashMap<String, usize>,
}

/// Derive a short, human progress label from a tool-start event.
fn progress_label(data: &Value) -> String {
  let tool = data.get("toolName").and_then(|v| v.as_str()).unwrap_or("Working");
  let detail = data
    .get("arguments")
    .and_then(|a| {
      a.get("description")
        .or_else(|| a.get("command"))
        .or_else(|| a.get("path"))
        .or_else(|| a.get("query"))
    })
    .and_then(|v| v.as_str())
    .unwrap_or("");
  let detail = detail.split_whitespace().collect::<Vec<_>>().join(" ");
  if detail.is_empty() {
    tool.to_string()
  } else {
    detail.chars().take(80).collect()
  }
}

/// Parse one JSONL line: accumulate assistant text and surface tool activity as
/// progress events.
fn handle_line(
  line: &str,
  st: &mut ReviewState,
  emit_progress: &mut dyn FnMut(String),
) {
  let trimmed = line.trim();
  if trimmed.is_empty() {
    return;
  }
  let Ok(raw) = serde_json::from_str::<Value>(trimmed) else {
    return;
  };
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
      st.assistant.push_str(text);
      *st.streamed.entry(id).or_insert(0) += text.chars().count();
    }
    "assistant.message" => {
      let id = data.get("messageId").and_then(|v| v.as_str()).unwrap_or("").to_string();
      let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
      let total = content.chars().count();
      let have = *st.streamed.get(&id).unwrap_or(&0);
      if total > have {
        let rest: String = content.chars().skip(have).collect();
        st.assistant.push_str(&rest);
        st.streamed.insert(id, total);
      }
    }
    "tool.execution_start" => {
      emit_progress(progress_label(data));
    }
    _ => {}
  }
}

/// Pull fenced code-block bodies out of `s`, stripping a short leading language
/// tag (e.g. ```json). Blocks are returned in document order.
fn fenced_blocks(s: &str) -> Vec<String> {
  let parts: Vec<&str> = s.split("```").collect();
  let mut out = Vec::new();
  let mut i = 1;
  while i < parts.len() {
    let mut block = parts[i];
    if let Some(nl) = block.find('\n') {
      let first = block[..nl].trim();
      // A bare language tag line has no JSON and is short ("json", "ts", ...).
      if !first.contains('{') && first.len() <= 12 {
        block = &block[nl + 1..];
      }
    }
    out.push(block.to_string());
    i += 2;
  }
  out
}

/// Best-effort extraction of the JSON report from Copilot's final message:
/// prefer the last fenced block that parses, then fall back to the widest
/// `{ ... }` slice.
fn extract_report(text: &str) -> Option<AdvisorRawReport> {
  for block in fenced_blocks(text).into_iter().rev() {
    if let Ok(report) = serde_json::from_str::<AdvisorRawReport>(block.trim()) {
      return Some(report);
    }
  }
  if let (Some(start), Some(end)) = (text.find('{'), text.rfind('}')) {
    if end > start {
      if let Ok(report) = serde_json::from_str::<AdvisorRawReport>(&text[start..=end]) {
        return Some(report);
      }
    }
  }
  None
}

/// Run a read-only Copilot security review of the project and return its report.
/// Always resolves to a report (with `ok` reflecting success) except for caller
/// errors (unknown project, or a run already in flight).
#[tauri::command]
pub async fn advisor_run(
  app: AppHandle,
  state: State<'_, AppState>,
  project_id: String,
) -> Result<AdvisorReport, String> {
  let Some(project) = store::find_project(&project_id) else {
    return Err("Project not found.".into());
  };

  let Some(token) = state.try_begin_advisor(&project_id) else {
    return Err("An analysis is already running for this project.".into());
  };

  let session_id = Uuid::new_v4().to_string();
  let cwd = PathBuf::from(&project.path);
  let args: Vec<&str> = vec![
    "-p",
    ADVISOR_PROMPT,
    "--output-format",
    "json",
    "--session-id",
    &session_id,
    "-C",
    &project.path,
    "--allow-all",
    "--no-color",
  ];

  let shared = Arc::new(Mutex::new(ReviewState::default()));
  let on_data: OnData = {
    let shared = shared.clone();
    let app = app.clone();
    let pid = project_id.clone();
    Arc::new(move |stream: Stream, chunk: &str| {
      if !matches!(stream, Stream::Stdout) {
        return;
      }
      let mut st = shared.lock().unwrap();
      st.buffer.push_str(chunk);
      let mut emit = |text: String| emit_advisor_event(&app, &pid, AdvisorEvent::Progress { text });
      while let Some(nl) = st.buffer.find('\n') {
        let line = st.buffer[..nl].to_string();
        st.buffer.replace_range(..=nl, "");
        handle_line(&line, &mut st, &mut emit);
      }
    })
  };

  let result = run(
    "copilot",
    &args,
    RunOptions {
      cwd: Some(cwd),
      env: vec![],
      on_data: Some(on_data),
      timeout_ms: Some(RUN_TIMEOUT_MS),
      cancel: Some(token.clone()),
    },
  )
  .await;

  // Flush any trailing partial line.
  {
    let mut st = shared.lock().unwrap();
    if !st.buffer.is_empty() {
      let line = std::mem::take(&mut st.buffer);
      let mut emit = |text: String| emit_advisor_event(&app, &project_id, AdvisorEvent::Progress { text });
      handle_line(&line, &mut st, &mut emit);
    }
  }

  state.end_advisor(&project_id);

  let assistant = shared.lock().unwrap().assistant.clone();

  // Map the outcome to a report, keeping the UI on a single happy path.
  let report = if token.is_cancelled() {
    AdvisorReport { ok: false, summary: "Analysis cancelled.".into(), findings: vec![] }
  } else if result.not_found {
    AdvisorReport {
      ok: false,
      summary: "The copilot CLI was not found on PATH.".into(),
      findings: vec![],
    }
  } else if let Some(raw) = extract_report(&assistant) {
    AdvisorReport { ok: true, summary: raw.summary, findings: raw.findings }
  } else {
    let detail = if !result.stderr.trim().is_empty() {
      result.stderr.trim().to_string()
    } else if !assistant.trim().is_empty() {
      assistant.trim().chars().take(600).collect()
    } else {
      format!(
        "copilot exited with code {}",
        result.exit_code.map(|c| c.to_string()).unwrap_or_else(|| "unknown".into())
      )
    };
    AdvisorReport {
      ok: false,
      summary: format!("Couldn't complete the analysis. {detail}"),
      findings: vec![],
    }
  };

  if !report.ok {
    emit_advisor_event(&app, &project_id, AdvisorEvent::Error { text: report.summary.clone() });
  }
  emit_advisor_event(&app, &project_id, AdvisorEvent::Done { ok: report.ok });
  Ok(report)
}

/// Cancel the in-flight review for a project, if any.
#[tauri::command]
pub fn advisor_cancel(state: State<'_, AppState>, project_id: String) -> bool {
  state.cancel_advisor(&project_id)
}
