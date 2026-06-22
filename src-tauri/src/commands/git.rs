//! Git operations (status/commit/log/changes/diff/revert). Ported from
//! `src/main/services/git.ts` + the git parts of `projects.ts` in a later phase.

use crate::types::{
  GitChange, GitCommitResult, GitFileDiff, GitHistory, GitStatus, RevertResult,
};

const PENDING: &str = "Git integration is being ported to the Tauri build.";

fn empty_status() -> GitStatus {
  GitStatus {
    is_repo: false,
    branch: None,
    changed_count: 0,
    no_commits: None,
  }
}

pub async fn git_status(_id: String) -> GitStatus {
  empty_status()
}

pub async fn git_commit(_id: String, _message: String) -> GitCommitResult {
  GitCommitResult {
    ok: false,
    error: Some(PENDING.to_string()),
    status: empty_status(),
  }
}

pub async fn git_log(_id: String) -> GitHistory {
  GitHistory {
    is_repo: false,
    no_commits: None,
    commits: vec![],
    working_changes: 0,
    head: None,
  }
}

pub async fn git_changes(_id: String, _reference: String) -> Vec<GitChange> {
  vec![]
}

pub async fn git_file_diff(
  _id: String,
  _reference: String,
  path: String,
  old_path: Option<String>,
) -> GitFileDiff {
  GitFileDiff {
    path,
    old_path,
    status: "modified".to_string(),
    before: String::new(),
    after: String::new(),
    binary: None,
    too_large: None,
    error: Some(PENDING.to_string()),
  }
}

pub async fn git_revert(_id: String, _reference: String) -> RevertResult {
  RevertResult {
    ok: false,
    head: None,
    no_changes: None,
    error: Some(PENDING.to_string()),
  }
}
