//! Capability-aware Fabric backup and AppBackend recovery.
//!
//! Fabric item definitions are exported when the REST API supports them. Every
//! item is inventoried even when no definition endpoint exists, so the manifest
//! never silently claims that metadata-only items are fully recoverable.

use std::path::PathBuf;
use std::sync::Arc;

use serde::Deserialize;
use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::commands::fabric::{project_auth_module, write_helper};
use crate::services::exec::{self, RunOptions, Stream};
use crate::services::{emit, paths, store};
use crate::types::{
    FabricBackupInput, FabricBackupResult, FabricImportAppInput, FabricImportAppResult,
    FabricItemsResult,
};

const FABRIC_API_BASE: &str = "https://api.fabric.microsoft.com/v1";
const HELPER_SOURCE: &str = include_str!("fabric_backup_helper.mjs");

fn error_items(message: impl Into<String>, needs_login: Option<bool>) -> FabricItemsResult {
    FabricItemsResult {
        ok: false,
        items: None,
        needs_login,
        error: Some(message.into()),
    }
}

fn error_backup(message: impl Into<String>, needs_login: Option<bool>) -> FabricBackupResult {
    FabricBackupResult {
        ok: false,
        path: None,
        workspace_count: 0,
        item_count: 0,
        definition_count: 0,
        metadata_only_count: 0,
        failed_count: 0,
        items: vec![],
        needs_login,
        error: Some(message.into()),
    }
}

fn error_import(message: impl Into<String>, needs_login: Option<bool>) -> FabricImportAppResult {
    FabricImportAppResult {
        ok: false,
        path: None,
        recoverable: false,
        project: None,
        needs_login,
        error: Some(message.into()),
    }
}

fn needs_login(message: &str) -> bool {
    let value = message.to_ascii_lowercase();
    [
        "silent",
        "cached",
        "account",
        "login",
        "token",
        "interactive",
        "sign",
    ]
    .iter()
    .any(|needle| value.contains(needle))
}

async fn helper_paths(
    config: serde_json::Value,
    suffix: &str,
) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let project_dir = store::active_project().map(|project| PathBuf::from(project.path));
    let auth = project_auth_module(project_dir.as_deref()).await?;
    let script = write_helper("fabric-backup.mjs", HELPER_SOURCE)
        .map_err(|error| format!("Could not prepare the Fabric backup helper: {error}"))?;
    let config_path = paths::ensure_data_dir()
        .map_err(|error| format!("Could not access the application data folder: {error}"))?
        .join(format!("fabric-backup-{suffix}.json"));
    let encoded = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Could not serialize the backup request: {error}"))?;
    std::fs::write(&config_path, encoded)
        .map_err(|error| format!("Could not write the backup request: {error}"))?;
    Ok((auth, script, config_path))
}

async fn run_helper(
    config: serde_json::Value,
    suffix: &str,
    timeout_ms: u64,
    on_data: Option<exec::OnData>,
) -> Result<exec::RunResult, String> {
    let (auth, script, config_path) = helper_paths(config, suffix).await?;
    let auth = auth.to_string_lossy().to_string();
    let script = script.to_string_lossy().to_string();
    let config = config_path.to_string_lossy().to_string();
    let result = exec::run(
        "node",
        &[&script, &auth, FABRIC_API_BASE, &config],
        RunOptions {
            timeout_ms: Some(timeout_ms),
            on_data,
            ..Default::default()
        },
    )
    .await;
    if result.not_found {
        Err("Node.js was not found on PATH.".to_string())
    } else {
        Ok(result)
    }
}

#[tauri::command]
pub async fn fabric_backup_pick_folder(app: AppHandle) -> Option<String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |picked| {
        let _ = tx.send(picked);
    });
    rx.await
        .ok()
        .flatten()?
        .into_path()
        .ok()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn fabric_workspace_items(workspace_id: String) -> FabricItemsResult {
    let config = json!({ "mode": "list", "workspaceId": workspace_id });
    let result = match run_helper(config, "list", 120_000, None).await {
        Ok(result) => result,
        Err(error) => return error_items(error, None),
    };
    let output = result.stdout.trim();
    serde_json::from_str::<FabricItemsResult>(output).unwrap_or_else(|_| {
        let message = if result.stderr.trim().is_empty() {
            if output.is_empty() {
                "Fabric returned no inventory result.".to_string()
            } else {
                output.to_string()
            }
        } else {
            result.stderr.trim().to_string()
        };
        error_items(message.clone(), Some(needs_login(&message)))
    })
}

#[tauri::command]
pub async fn fabric_backup_run(app: AppHandle, input: FabricBackupInput) -> FabricBackupResult {
    if input.workspaces.is_empty() {
        return error_backup("Select at least one workspace.", None);
    }
    let output_root = input.output_root.trim();
    if output_root.is_empty() || !std::path::Path::new(output_root).is_dir() {
        return error_backup("Choose an existing folder for the backup.", None);
    }
    let config = json!({
      "mode": "backup",
      "outputRoot": output_root,
      "workspaces": input.workspaces,
    });
    let stream = emit::proc_streamer(&app, "backup:run");
    let on_data: exec::OnData = Arc::new(move |kind, text| {
        if kind != Stream::Stdout {
            stream(kind, text);
        }
    });
    let result = match run_helper(config, "run", 30 * 60_000, Some(on_data)).await {
        Ok(result) => result,
        Err(error) => return error_backup(error, None),
    };
    let output = result.stdout.trim();
    serde_json::from_str::<FabricBackupResult>(output).unwrap_or_else(|_| {
        let message = if result.stderr.trim().is_empty() {
            if output.is_empty() {
                "Fabric returned no backup result.".to_string()
            } else {
                output.to_string()
            }
        } else {
            result.stderr.trim().to_string()
        };
        error_backup(message.clone(), Some(needs_login(&message)))
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HelperImportResult {
    ok: bool,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    recoverable: bool,
    #[serde(default)]
    needs_login: Option<bool>,
    #[serde(default)]
    error: Option<String>,
}

#[tauri::command]
pub async fn fabric_import_app(input: FabricImportAppInput) -> FabricImportAppResult {
    let output_root = store::get_state().workspace_root;
    if let Err(error) = std::fs::create_dir_all(&output_root) {
        return error_import(
            format!("Could not create the local workspace folder: {error}"),
            None,
        );
    }
    let config = json!({
      "mode": "import",
      "outputRoot": output_root,
      "workspaceId": input.workspace_id,
      "workspaceName": input.workspace_name,
      "itemId": input.item_id,
      "displayName": input.display_name,
      "itemType": input.item_type,
    });
    let result = match run_helper(config, "import", 10 * 60_000, None).await {
        Ok(result) => result,
        Err(error) => return error_import(error, None),
    };
    let output = result.stdout.trim();
    let parsed = match serde_json::from_str::<HelperImportResult>(output) {
        Ok(parsed) => parsed,
        Err(_) => {
            let message = if result.stderr.trim().is_empty() {
                output.to_string()
            } else {
                result.stderr.trim().to_string()
            };
            return error_import(message.clone(), Some(needs_login(&message)));
        }
    };
    if !parsed.ok || !parsed.recoverable {
        return FabricImportAppResult {
            ok: false,
            path: parsed.path,
            recoverable: false,
            project: None,
            needs_login: parsed.needs_login,
            error: parsed.error,
        };
    }
    let Some(path) = parsed.path else {
        return error_import("Fabric did not return a local project path.", None);
    };
    let opened = crate::commands::projects_impl::open_project(path.clone()).await;
    let Some(project) = opened.project else {
        return FabricImportAppResult {
            ok: false,
            path: Some(path),
            recoverable: true,
            project: None,
            needs_login: None,
            error: opened.error,
        };
    };
    store::mutate_project(&project.id, |stored| {
        stored.organization_id = input.organization_id.clone();
        stored.workspace = Some(input.workspace_id.clone());
        stored.workspace_name = Some(input.workspace_name.clone());
    });
    FabricImportAppResult {
        ok: true,
        path: Some(path),
        recoverable: true,
        project: store::find_project(&project.id),
        needs_login: None,
        error: None,
    }
}
