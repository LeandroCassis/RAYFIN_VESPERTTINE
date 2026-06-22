//! Side threads (list/create/remove/merge). Ported from
//! `src/main/services/threads.ts` + `merge.ts` in a later phase.

use crate::services::store;
use crate::types::{CreateThreadInput, MergeResult, ProjectThread, ThreadActionResult};

const PENDING: &str = "Side threads are being ported to the Tauri build.";

fn project_threads(project_id: &str) -> Vec<ProjectThread> {
  store::find_project(project_id)
    .and_then(|p| p.threads)
    .unwrap_or_default()
}

#[tauri::command]
pub fn threads_list(project_id: String) -> Vec<ProjectThread> {
  project_threads(&project_id)
}

#[tauri::command]
pub async fn threads_create(input: CreateThreadInput) -> ThreadActionResult {
  ThreadActionResult {
    ok: false,
    error: Some(PENDING.to_string()),
    thread: None,
    threads: project_threads(&input.project_id),
  }
}

#[tauri::command]
pub async fn threads_remove(project_id: String, _thread_id: String) -> ThreadActionResult {
  ThreadActionResult {
    ok: false,
    error: Some(PENDING.to_string()),
    thread: None,
    threads: project_threads(&project_id),
  }
}

#[tauri::command]
pub async fn threads_merge(project_id: String, _thread_id: String) -> MergeResult {
  MergeResult {
    ok: false,
    error: Some(PENDING.to_string()),
    had_conflicts: None,
    merge_commit: None,
    threads: project_threads(&project_id),
  }
}
