//! Rayfin CLI/SDK version detection. Ported from
//! `src/main/services/rayfinVersion.ts` in a later phase.

use crate::types::RayfinVersionInfo;

#[tauri::command]
pub async fn rayfin_versions(_id: String) -> RayfinVersionInfo {
  RayfinVersionInfo {
    version: None,
    latest: None,
    upgrade_available: false,
    packages: vec![],
  }
}
