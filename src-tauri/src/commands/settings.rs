//! Settings commands: get + patch (theme, experiment flags).

use serde::Deserialize;

use crate::services::store;
use crate::types::{AppSettings, ExperimentFlags, OrganizationProfile, VisualSettings};

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
