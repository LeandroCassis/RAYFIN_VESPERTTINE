//! Misc app commands: ping, version info, open-external, open-logs, relaunch.

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::error::{AppError, AppResult};
use crate::services::paths;
use crate::types::AppVersions;

#[tauri::command]
pub fn ping() -> &'static str {
  "pong"
}

/// Version info for the About/Settings panel. Under Tauri there is no Node/V8
/// runtime, so those fields report the closest equivalents (Tauri + WebView2).
#[tauri::command]
pub fn get_versions(app: AppHandle) -> AppVersions {
  let pkg = app.package_info();
  AppVersions {
    app: pkg.version.to_string(),
    electron: tauri::VERSION.to_string(),
    chrome: webview_version(),
    node: rustc_version(),
    v8: String::new(),
  }
}

fn webview_version() -> String {
  tauri::webview_version().unwrap_or_default()
}

fn rustc_version() -> String {
  // Best-effort: the compiler version baked in at build time is not available
  // at runtime without a build script, so report the Tauri runtime instead.
  format!("tauri {}", tauri::VERSION)
}

/// Open a URL in the user's default browser (http/https only).
#[tauri::command]
pub async fn open_external(app: AppHandle, url: String) -> AppResult<()> {
  if url.starts_with("http://") || url.starts_with("https://") {
    app
      .opener()
      .open_url(url, None::<&str>)
      .map_err(|e| AppError::Msg(e.to_string()))?;
  }
  Ok(())
}

/// Open the logs folder in the OS file manager; returns its path.
#[tauri::command]
pub async fn open_logs(app: AppHandle) -> AppResult<String> {
  let dir = paths::logs_dir();
  let path = dir.to_string_lossy().to_string();
  app
    .opener()
    .open_path(path.clone(), None::<&str>)
    .map_err(|e| AppError::Msg(e.to_string()))?;
  Ok(path)
}

/// Restart the app (used to pick up newly installed Node/Git on PATH).
#[tauri::command]
pub fn relaunch(app: AppHandle) {
  app.restart();
}
