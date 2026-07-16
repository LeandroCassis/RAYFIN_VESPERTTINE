//! Settings commands: get + patch (theme, experiment flags).

use serde::Deserialize;

use crate::services::{ai_provider, store};
use crate::types::{
  AiProviderStatus, AppSettings, ExperimentFlags, OrganizationProfile, VisualSettings,
};

#[tauri::command]
pub fn settings_get() -> AppSettings {
  store::get_settings()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
  #[serde(default)]
  theme: Option<String>,
  #[serde(default)]
  ui_scale: Option<f64>,
  #[serde(default)]
  experiments: Option<ExperimentFlags>,
  #[serde(default)]
  visual: Option<VisualSettings>,
  #[serde(default)]
  organization_profiles: Option<Vec<OrganizationProfile>>,
  #[serde(default)]
  active_organization_id: Option<String>,
  #[serde(default)]
  full_diagnostics: Option<bool>,
}

#[tauri::command]
pub fn settings_set(patch: SettingsPatch) -> AppSettings {
  store::set_settings(
    patch.theme,
    patch.ui_scale,
    patch.experiments,
    patch.visual,
    patch.organization_profiles,
    patch.active_organization_id,
    patch.full_diagnostics,
  )
}

/// Returns only non-sensitive state for the selected Tenant's AI connection.
#[tauri::command]
pub fn settings_openrouter_status(profile_id: Option<String>) -> AiProviderStatus {
  ai_provider::status(profile_id.as_deref())
}

/// Save an OpenRouter key to the operating system credential store. It never
/// enters the JSON settings store or any renderer-visible result.
#[tauri::command]
pub fn settings_save_openrouter_key(
  profile_id: String,
  api_key: String,
) -> Result<AiProviderStatus, String> {
  ai_provider::save_openrouter_key(&profile_id, &api_key)?;
  Ok(ai_provider::status(Some(&profile_id)))
}

#[tauri::command]
pub fn settings_remove_openrouter_key(profile_id: String) -> Result<AiProviderStatus, String> {
  ai_provider::remove_openrouter_key(&profile_id)?;
  Ok(ai_provider::status(Some(&profile_id)))
}
