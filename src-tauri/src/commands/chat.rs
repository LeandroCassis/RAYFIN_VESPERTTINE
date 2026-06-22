//! Chat commands (Copilot CLI). History/options/cancel/reset are implemented
//! against the store + history modules; the streaming `chat_send` turn engine
//! (Copilot JSONL parsing) is ported from `src/main/services/chat.ts` in a later
//! phase.

use tauri::State;

use crate::services::history::{self, MAIN_THREAD_ID};
use crate::services::store;
use crate::state::AppState;
use crate::types::{ChatMessage, ChatOptions, ChatTurnResult};

const PENDING: &str = "The chat engine is being ported to the Tauri build.";

fn thread_opt(thread_id: &Option<String>) -> Option<&str> {
  thread_id.as_deref()
}

#[tauri::command]
pub async fn chat_send(
  _state: State<'_, AppState>,
  _project_id: String,
  _turn_id: String,
  _text: String,
  _attachments: Option<Vec<String>>,
  _thread_id: Option<String>,
) -> Result<ChatTurnResult, String> {
  Ok(ChatTurnResult {
    ok: false,
    error: Some(PENDING.to_string()),
    files_modified: vec![],
    ran_deploy: false,
  })
}

#[tauri::command]
pub fn chat_cancel(state: State<'_, AppState>, project_id: String, thread_id: Option<String>) {
  state.cancel_chat(&project_id, thread_opt(&thread_id));
}

#[tauri::command]
pub fn chat_reset(project_id: String, thread_id: Option<String>) {
  let tid = thread_opt(&thread_id);
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
  store::mutate_project(&project_id, |p| {
    p.model = options.model.clone();
    p.effort = options.effort.clone();
  });
}
