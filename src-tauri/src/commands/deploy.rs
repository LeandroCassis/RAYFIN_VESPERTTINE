//! Deploy commands (`rayfin up`). Ported from `src/main/services/deploy.ts`
//! in a later phase. Read-only `status`/`hasChanges`/`list` return safe
//! defaults; the mutating run/switch/setName flows report a pending message.

use crate::services::store;
use crate::types::{DeployResult, DeployStatus, FabricDeployment, ProjectsState};

const PENDING: &str = "Deploy is being ported to the Tauri build.";

#[tauri::command]
pub async fn deploy_run(
  _project_id: String,
  _workspace: Option<String>,
  _force: Option<bool>,
) -> DeployResult {
  DeployResult {
    ok: false,
    outcome: "error".to_string(),
    url: None,
    api_url: None,
    portal_url: None,
    error: Some(PENDING.to_string()),
  }
}

#[tauri::command]
pub async fn deploy_status(_project_id: String) -> DeployStatus {
  DeployStatus {
    deployed: false,
    url: None,
    api_url: None,
    portal_url: None,
  }
}

#[tauri::command]
pub async fn deploy_has_changes(_project_id: String) -> bool {
  false
}

#[tauri::command]
pub async fn deploy_list(_project_id: String) -> Vec<FabricDeployment> {
  vec![]
}

#[tauri::command]
pub async fn deploy_switch(
  _project_id: String,
  _workspace: String,
  _by_id: Option<bool>,
) -> DeployResult {
  DeployResult {
    ok: false,
    outcome: "error".to_string(),
    url: None,
    api_url: None,
    portal_url: None,
    error: Some(PENDING.to_string()),
  }
}

#[tauri::command]
pub async fn deploy_set_name(
  _project_id: String,
  _workspace_key: String,
  _name: String,
) -> ProjectsState {
  store::get_state()
}
