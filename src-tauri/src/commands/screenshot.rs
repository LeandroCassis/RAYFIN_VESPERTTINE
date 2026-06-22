//! Screenshot persistence for region-capture attachments. Ported from
//! `src/main/services/screenshot.ts`. Deferred for the MVP per the migration
//! plan, but the save/cleanup plumbing is implemented so chat attachments work.

use std::path::PathBuf;

use base64::Engine;

use crate::services::paths;

const PENDING: &str = "Screenshot capture is deferred in the Tauri build.";

/// Persist a PNG data URL to a temp file under Studio's shots dir; returns its path.
#[tauri::command]
pub async fn screenshot_save(data_url: String) -> Result<String, String> {
  let comma = data_url.find(',').ok_or_else(|| PENDING.to_string())?;
  let b64 = &data_url[comma + 1..];
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(b64.as_bytes())
    .map_err(|e| e.to_string())?;
  let dir = paths::shots_dir();
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let name = format!("shot-{}.png", uuid::Uuid::new_v4());
  let path = dir.join(name);
  std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

/// Best-effort delete of temp screenshot files (only within Studio's shots dir).
#[tauri::command]
pub async fn screenshot_cleanup(paths: Vec<String>) {
  cleanup(&paths);
}

/// Delete the given temp screenshot files, restricted to Studio's shots dir.
/// Shared by the `screenshot_cleanup` command and the chat turn engine.
pub fn cleanup(paths: &[String]) {
  let shots = crate::services::paths::shots_dir();
  for p in paths {
    let path = PathBuf::from(p);
    if path.starts_with(&shots) {
      let _ = std::fs::remove_file(&path);
    }
  }
}
