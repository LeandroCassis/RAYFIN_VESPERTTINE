//! Fabric workspace enumeration + app deletion. Ported from
//! `src/main/services/fabric.ts` in a later phase.

use crate::types::{FabricDeleteResult, FabricWorkspacesResult};

const PENDING: &str = "Fabric integration is being ported to the Tauri build.";

#[tauri::command]
pub async fn fabric_workspaces() -> FabricWorkspacesResult {
  FabricWorkspacesResult {
    ok: false,
    workspaces: None,
    needs_login: None,
    error: Some(PENDING.to_string()),
  }
}

#[tauri::command]
pub async fn fabric_delete_apps(_project_id: String) -> FabricDeleteResult {
  FabricDeleteResult {
    ok: true,
    deleted: 0,
    failures: vec![],
    needs_login: None,
    error: None,
  }
}
