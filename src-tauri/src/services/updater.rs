//! In-app auto-update built on `tauri-plugin-updater`. The renderer drives this
//! through `window.api.updates` (`check` / `download` / `install`); download
//! progress streams to the renderer on the `update:progress` event.
//!
//! Flow: `check` looks for a newer release (no download); `download` fetches the
//! installer in the background and retains its bytes; `install` applies those
//! bytes and restarts. Endpoints + the signing public key come from
//! `tauri.conf.json` (`plugins.updater`).

use std::sync::Mutex;

use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::error::{AppError, AppResult};
use crate::services::emit::UPDATE_PROGRESS;
use crate::types::{UpdateInfo, UpdateProgress};

/// Holds the update found by a check and, once fetched, its installer bytes, so a
/// later `install` can apply them without downloading again.
#[derive(Default)]
pub struct UpdaterState {
  update: Mutex<Option<Update>>,
  bytes: Mutex<Option<Vec<u8>>>,
}

fn info_from(update: &Update) -> UpdateInfo {
  UpdateInfo {
    version: update.version.clone(),
    current_version: update.current_version.clone(),
    notes: update.body.clone(),
    date: update.date.map(|d| d.to_string()),
  }
}

async fn run_check(app: &AppHandle) -> AppResult<Option<Update>> {
  let updater = app.updater().map_err(|e| AppError::Msg(e.to_string()))?;
  updater
    .check()
    .await
    .map_err(|e| AppError::Msg(e.to_string()))
}

/// Check for a newer release without downloading. Caches the result for `download`.
pub async fn check(app: &AppHandle, state: &UpdaterState) -> AppResult<Option<UpdateInfo>> {
  let found = run_check(app).await?;
  let info = found.as_ref().map(info_from);
  *state.bytes.lock().unwrap() = None;
  *state.update.lock().unwrap() = found;
  Ok(info)
}

/// Download the pending update (checking first if needed) in the background,
/// emitting `update:progress`. Retains the installer bytes for `install`.
pub async fn download(app: &AppHandle, state: &UpdaterState) -> AppResult<Option<UpdateInfo>> {
  let mut update = state.update.lock().unwrap().clone();
  if update.is_none() {
    update = run_check(app).await?;
    *state.update.lock().unwrap() = update.clone();
  }
  let Some(update) = update else {
    return Ok(None);
  };
  let info = info_from(&update);

  let app_dl = app.clone();
  let mut downloaded: u64 = 0;
  let bytes = update
    .download(
      move |chunk_len, content_len| {
        downloaded += chunk_len as u64;
        let _ = app_dl.emit(
          UPDATE_PROGRESS,
          UpdateProgress {
            downloaded,
            total: content_len,
          },
        );
      },
      || {},
    )
    .await
    .map_err(|e| AppError::Msg(e.to_string()))?;

  *state.bytes.lock().unwrap() = Some(bytes);
  Ok(Some(info))
}

/// Install the previously downloaded update, then restart the app.
pub async fn install(app: &AppHandle, state: &UpdaterState) -> AppResult<()> {
  let update = state.update.lock().unwrap().clone();
  let bytes = state.bytes.lock().unwrap().take();
  let (Some(update), Some(bytes)) = (update, bytes) else {
    return Err(AppError::Msg(
      "No downloaded update to install. Check for updates first.".into(),
    ));
  };
  update
    .install(bytes)
    .map_err(|e| AppError::Msg(e.to_string()))?;
  app.restart();
  #[allow(unreachable_code)]
  Ok(())
}
