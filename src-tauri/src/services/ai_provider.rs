//! Tenant-scoped AI provider settings and OpenRouter credential handling.
//!
//! The application settings file keeps only non-sensitive metadata (provider and
//! default model). OpenRouter credentials are written to the operating system's
//! credential vault through `keyring`, and are never serialized into `studio.json`
//! or sent back to the renderer.

use keyring::Entry;
use reqwest::header::AUTHORIZATION;
use serde::Deserialize;

use crate::services::store;
use crate::types::{AiProviderStatus, CopilotModel, OrganizationProfile};

const KEYRING_SERVICE: &str = "VESPERTTINE RAYFIN EDITOR";
const OPENROUTER_MODELS_URL: &str = "https://openrouter.ai/api/v1/models";
const OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AiProviderKind {
  Github,
  OpenRouter,
}

#[derive(Clone, PartialEq, Eq)]
pub struct ActiveAiProvider {
  pub kind: AiProviderKind,
  pub default_model: Option<String>,
  pub api_key: Option<String>,
}

fn profile_for(profile_id: Option<&str>) -> Option<OrganizationProfile> {
  let settings = store::get_settings();
  let wanted = profile_id
    .map(str::to_string)
    .or(settings.active_organization_id);
  let wanted = wanted?;
  settings
    .organization_profiles
    .unwrap_or_default()
    .into_iter()
    .find(|profile| profile.id == wanted)
}

fn provider_from(profile: Option<&OrganizationProfile>) -> AiProviderKind {
  match profile
    .and_then(|item| item.ai_provider.as_deref())
    .map(str::trim)
  {
    Some("openrouter") => AiProviderKind::OpenRouter,
    _ => AiProviderKind::Github,
  }
}

fn keyring_entry(profile_id: &str) -> Result<Entry, String> {
  Entry::new(KEYRING_SERVICE, &format!("openrouter:{profile_id}"))
    .map_err(|error| format!("Couldn't access the secure credential store: {error}"))
}

pub fn openrouter_configured(profile_id: &str) -> bool {
  keyring_entry(profile_id)
    .and_then(|entry| entry.get_password().map_err(|_| "missing key".to_string()))
    .map(|key| !key.trim().is_empty())
    .unwrap_or(false)
}

pub fn save_openrouter_key(profile_id: &str, api_key: &str) -> Result<(), String> {
  let key = api_key.trim();
  if profile_id.trim().is_empty() {
    return Err("Choose a Tenant before adding an OpenRouter key.".to_string());
  }
  if key.len() < 8 {
    return Err("Enter a valid OpenRouter API key.".to_string());
  }
  keyring_entry(profile_id)?
    .set_password(key)
    .map_err(|error| format!("Couldn't save the OpenRouter key securely: {error}"))
}

pub fn remove_openrouter_key(profile_id: &str) -> Result<(), String> {
  if profile_id.trim().is_empty() {
    return Err("Choose a Tenant before removing an OpenRouter key.".to_string());
  }
  // Missing credentials already satisfy the requested end state.
  let _ = keyring_entry(profile_id)?.delete_credential();
  Ok(())
}

fn openrouter_key(profile_id: &str) -> Result<String, String> {
  let key = keyring_entry(profile_id)?
    .get_password()
    .map_err(|_| "Add an OpenRouter API key in Settings before using OpenRouter.".to_string())?;
  if key.trim().is_empty() {
    return Err("Add an OpenRouter API key in Settings before using OpenRouter.".to_string());
  }
  Ok(key)
}

pub fn active_configuration() -> Result<ActiveAiProvider, String> {
  let profile = profile_for(None);
  let kind = provider_from(profile.as_ref());
  let default_model = profile.as_ref().and_then(|item| item.ai_model.clone());
  let api_key = match kind {
    AiProviderKind::Github => None,
    AiProviderKind::OpenRouter => {
      let id = profile
        .as_ref()
        .map(|item| item.id.as_str())
        .ok_or_else(|| "Select a Tenant before using OpenRouter.".to_string())?;
      Some(openrouter_key(id)?)
    }
  };
  Ok(ActiveAiProvider {
    kind,
    default_model,
    api_key,
  })
}

pub fn status(profile_id: Option<&str>) -> AiProviderStatus {
  let profile = profile_for(profile_id);
  let provider = provider_from(profile.as_ref());
  AiProviderStatus {
    provider: match provider {
      AiProviderKind::Github => "github".to_string(),
      AiProviderKind::OpenRouter => "openrouter".to_string(),
    },
    model: profile.as_ref().and_then(|item| item.ai_model.clone()),
    openrouter_configured: profile
      .as_ref()
      .is_some_and(|item| openrouter_configured(&item.id)),
  }
}

#[derive(Deserialize)]
struct OpenRouterModelsResponse {
  #[serde(default)]
  data: Vec<OpenRouterModel>,
}

#[derive(Deserialize)]
struct OpenRouterModel {
  id: String,
  #[serde(default)]
  name: Option<String>,
}

/// Fetch the models enabled for the supplied OpenRouter key. This is intentionally
/// done by the backend so the renderer never handles or logs the credential.
pub async fn list_openrouter_models(api_key: &str) -> Result<Vec<CopilotModel>, String> {
  let response = reqwest::Client::new()
    .get(OPENROUTER_MODELS_URL)
    .header(AUTHORIZATION, format!("Bearer {api_key}"))
    .header("HTTP-Referer", "https://vesperttine.local")
    .header("X-Title", "VESPERTTINE RAYFIN EDITOR")
    .send()
    .await
    .map_err(|error| format!("Couldn't reach OpenRouter: {error}"))?;
  if !response.status().is_success() {
    return Err(format!(
      "OpenRouter rejected the model request (HTTP {}). Check the API key in Settings.",
      response.status()
    ));
  }
  let mut models = response
    .json::<OpenRouterModelsResponse>()
    .await
    .map_err(|error| format!("OpenRouter returned an invalid model list: {error}"))?
    .data
    .into_iter()
    .filter(|model| !model.id.trim().is_empty())
    .map(|model| CopilotModel {
      name: model.name.unwrap_or_else(|| model.id.clone()),
      id: model.id,
      supported_reasoning_efforts: Vec::new(),
      default_reasoning_effort: None,
    })
    .collect::<Vec<_>>();
  models.sort_by(|a, b| {
    a.name
      .to_ascii_lowercase()
      .cmp(&b.name.to_ascii_lowercase())
  });
  Ok(models)
}

pub fn openrouter_base_url() -> &'static str {
  OPENROUTER_BASE_URL
}
