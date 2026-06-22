//! Project file browsing (tree + read). Ported from `src/main/services/files.ts`
//! in a later phase.

use crate::types::{FileContent, FileNode};

const PENDING: &str = "File browsing is being ported to the Tauri build.";

pub async fn files_tree(_id: String) -> Vec<FileNode> {
  vec![]
}

pub async fn files_read(_id: String, path: String) -> FileContent {
  FileContent {
    path,
    size: 0,
    content: None,
    binary: None,
    too_large: None,
    error: Some(PENDING.to_string()),
  }
}
