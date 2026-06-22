//! Heavy projects logic (scaffold/open/rename/remove/templates). The scaffolding
//! and registration flows are ported from `src/main/services/projects.ts` in a
//! later phase; for now the read-only/template paths return useful defaults and
//! the mutating flows report a clear "being ported" message.

use tauri::AppHandle;

use crate::services::store;
use crate::types::{
  CommunityGalleryResult, CreateProjectInput, ProjectActionResult, ProjectsState, TemplateInfo,
};

const PENDING: &str = "This action is being ported to the Tauri build.";

/// The built-in Rayfin templates (mirrors `rayfin init --list-templates`).
pub async fn list_templates() -> Vec<TemplateInfo> {
  vec![
    TemplateInfo {
      name: "blankapp".into(),
      display_name: "Blank app".into(),
      description: "A minimal Rayfin app to start from scratch.".into(),
    },
    TemplateInfo {
      name: "dataapp".into(),
      display_name: "Data app".into(),
      description: "A data-driven app wired to a Fabric data source.".into(),
    },
    TemplateInfo {
      name: "gettingstartedauth".into(),
      display_name: "Getting started (auth)".into(),
      description: "A starter app demonstrating authentication.".into(),
    },
    TemplateInfo {
      name: "todoapp".into(),
      display_name: "To-do app".into(),
      description: "A simple to-do list sample app.".into(),
    },
  ]
}

pub async fn list_community_templates(_repo_url: Option<String>) -> CommunityGalleryResult {
  CommunityGalleryResult {
    ok: false,
    error: Some(PENDING.to_string()),
    gallery: None,
  }
}

pub async fn create_project(_app: &AppHandle, _input: CreateProjectInput) -> ProjectActionResult {
  ProjectActionResult {
    ok: false,
    error: Some(PENDING.to_string()),
    project: None,
  }
}

pub async fn open_project(_path: String) -> ProjectActionResult {
  ProjectActionResult {
    ok: false,
    error: Some(PENDING.to_string()),
    project: None,
  }
}

pub async fn rename_project(_id: String, _name: String) -> ProjectActionResult {
  ProjectActionResult {
    ok: false,
    error: Some(PENDING.to_string()),
    project: None,
  }
}

pub async fn remove_project(_app: &AppHandle, id: String, _delete_files: bool) -> ProjectsState {
  // Forget the project (file deletion / Fabric cleanup ported later).
  store::remove_project(&id)
}
