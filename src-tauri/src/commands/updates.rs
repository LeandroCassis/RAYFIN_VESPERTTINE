//! In-app auto-update commands backing `window.api.updates`. The heavy lifting
//! lives in [`crate::services::updater`]; these are thin Tauri wrappers.

use tauri::{AppHandle, State};

use crate::error::AppResult;
use crate::services::updater::{self, UpdaterState};
use crate::types::UpdateInfo;

/// Check for an available update without downloading it.
#[tauri::command]
pub async fn update_check(
  app: AppHandle,
  state: State<'_, UpdaterState>,
) -> AppResult<Option<UpdateInfo>> {
  updater::check(&app, state.inner()).await
}

/// Download the pending update in the background (emits `update:progress`).
#[tauri::command]
pub async fn update_download(
  app: AppHandle,
  state: State<'_, UpdaterState>,
) -> AppResult<Option<UpdateInfo>> {
  updater::download(&app, state.inner()).await
}

/// Install the downloaded update and restart the app.
#[tauri::command]
pub async fn update_install(app: AppHandle, state: State<'_, UpdaterState>) -> AppResult<()> {
  updater::install(&app, state.inner()).await
}
