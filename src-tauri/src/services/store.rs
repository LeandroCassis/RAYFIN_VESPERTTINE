//! JSON-file persistence for app state — the Rust counterpart to
//! `src/main/services/store.ts`. State lives in `studio.json` under the per-user
//! data directory and is cached in memory after first read. Credentials are never
//! persisted here (each CLI owns its own credential store).

use std::sync::Mutex;

use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::Value;

use super::paths;
use crate::types::{
  AppSettings, ExperimentFlags, OrganizationProfile, ProjectsState, StudioProject, VisualSettings,
};

struct Cache {
  state: ProjectsState,
  settings: AppSettings,
}

static CACHE: Lazy<Mutex<Option<Cache>>> = Lazy::new(|| Mutex::new(None));

fn default_state() -> ProjectsState {
  ProjectsState {
    workspace_root: paths::home_dir()
      .join("RayfinProjects")
      .to_string_lossy()
      .to_string(),
    active_project_id: None,
    projects: vec![],
  }
}

fn default_settings() -> AppSettings {
  AppSettings {
    theme: "dark".to_string(),
    ui_scale: Some(1.0),
    experiments: Some(ExperimentFlags {
      compatibility_rendering: Some(false),
      chat_mode_selector: Some(false),
      local_dev_preview: Some(false),
    }),
    visual: None,
    organization_profiles: None,
    active_organization_id: None,
    full_diagnostics: Some(false),
  }
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawStore {
  workspace_root: Option<String>,
  #[serde(default)]
  active_project_id: Option<String>,
  #[serde(default)]
  projects: Vec<StudioProject>,
  #[serde(default)]
  settings: Option<AppSettings>,
}

fn load() -> Cache {
  match std::fs::read_to_string(paths::store_file()) {
    Ok(raw) => match serde_json::from_str::<RawStore>(&raw) {
      Ok(parsed) => {
        let mut state = default_state();
        if let Some(root) = parsed.workspace_root {
          state.workspace_root = root;
        }
        state.active_project_id = parsed.active_project_id;
        state.projects = parsed.projects;
        let settings = parsed.settings.unwrap_or_else(default_settings);
        Cache { state, settings }
      }
      Err(_) => Cache {
        state: default_state(),
        settings: default_settings(),
      },
    },
    Err(_) => Cache {
      state: default_state(),
      settings: default_settings(),
    },
  }
}

fn with_cache<R>(f: impl FnOnce(&mut Cache) -> R) -> R {
  let mut guard = CACHE.lock().unwrap();
  if guard.is_none() {
    *guard = Some(load());
  }
  f(guard.as_mut().unwrap())
}

/// Write the current cache to disk as `{ ...state, settings }`.
fn persist(cache: &Cache) {
  let _ = paths::ensure_data_dir();
  let mut value = match serde_json::to_value(&cache.state) {
    Ok(v) => v,
    Err(_) => return,
  };
  if let Value::Object(ref mut map) = value {
    if let Ok(s) = serde_json::to_value(&cache.settings) {
      map.insert("settings".to_string(), s);
    }
  }
  match serde_json::to_string_pretty(&value) {
    Ok(text) => {
      if let Err(e) = std::fs::write(paths::store_file(), text) {
        log::error!(
          "failed to persist project store to {}: {e}",
          paths::store_file().display()
        );
      }
    }
    Err(e) => log::error!("failed to serialize project store: {e}"),
  }
}

pub fn get_state() -> ProjectsState {
  with_cache(|c| c.state.clone())
}

pub fn get_settings() -> AppSettings {
  with_cache(|c| c.settings.clone())
}

fn valid_hex_color(color: &str) -> bool {
  color.len() == 7 && color.starts_with('#') && color.chars().skip(1).all(|c| c.is_ascii_hexdigit())
}

/// Patch fields of the settings (deep-merging nested settings) and persist.
pub fn set_settings(
  theme: Option<String>,
  ui_scale: Option<f64>,
  experiments: Option<ExperimentFlags>,
  visual: Option<VisualSettings>,
  organization_profiles: Option<Vec<OrganizationProfile>>,
  active_organization_id: Option<String>,
  full_diagnostics: Option<bool>,
) -> AppSettings {
  with_cache(|c| {
    if let Some(t) = theme {
      c.settings.theme = t;
    }
    if let Some(s) = ui_scale {
      c.settings.ui_scale = Some(s.clamp(0.8, 2.0));
    }
    if let Some(v) = full_diagnostics {
      c.settings.full_diagnostics = Some(v);
    }
    if let Some(patch) = experiments {
      let current = c.settings.experiments.get_or_insert(ExperimentFlags {
        compatibility_rendering: Some(false),
        chat_mode_selector: Some(false),
        local_dev_preview: Some(false),
      });
      if let Some(v) = patch.compatibility_rendering {
        current.compatibility_rendering = Some(v);
      }
      if let Some(v) = patch.chat_mode_selector {
        current.chat_mode_selector = Some(v);
      }
      if let Some(v) = patch.local_dev_preview {
        current.local_dev_preview = Some(v);
      }
    }
    if let Some(patch) = visual {
      let current = c.settings.visual.get_or_insert(VisualSettings {
        accent_color: None,
        surface_color: None,
        border_radius: None,
        app_icon: None,
      });
      if let Some(color) = patch.accent_color.filter(|value| valid_hex_color(value)) {
        current.accent_color = Some(color);
      }
      if let Some(color) = patch.surface_color.filter(|value| valid_hex_color(value)) {
        current.surface_color = Some(color);
      }
      if let Some(radius) = patch.border_radius {
        current.border_radius = Some(radius.clamp(0.0, 28.0));
      }
      if let Some(icon) = patch
        .app_icon
        .filter(|value| value == "mark" || value == "monogram")
      {
        current.app_icon = Some(icon);
      }
    }
    if let Some(profiles) = organization_profiles {
      c.settings.organization_profiles = Some(
        profiles
          .into_iter()
          .filter(|p| {
            !p.id.trim().is_empty() && !p.name.trim().is_empty() && !p.tenant_id.trim().is_empty()
          })
          .collect(),
      );
    }
    if let Some(id) = active_organization_id.filter(|value| !value.trim().is_empty()) {
      c.settings.active_organization_id = Some(id);
    }
    persist(c);
    c.settings.clone()
  })
}

pub fn set_workspace_root(path: String) -> ProjectsState {
  with_cache(|c| {
    c.state.workspace_root = path;
    persist(c);
    c.state.clone()
  })
}

pub fn set_active(id: Option<String>) -> ProjectsState {
  with_cache(|c| {
    if let Some(ref want) = id {
      // The active project must belong to the active organization. This mirrors
      // the renderer filter at the persistence boundary, preventing an old id
      // from carrying across a tenant switch.
      if let Some(ref organization_id) = c.settings.active_organization_id {
        let belongs = c
          .state
          .projects
          .iter()
          .find(|p| &p.id == want)
          .and_then(|p| p.organization_id.as_ref())
          == Some(organization_id);
        if !belongs {
          return c.state.clone();
        }
      }
      // Bump the selected project to the front so Home shows true
      // most-recently-used order (matches how upsert_project front-loads
      // newly created / opened projects).
      if let Some(pos) = c.state.projects.iter().position(|p| &p.id == want) {
        if pos != 0 {
          let p = c.state.projects.remove(pos);
          c.state.projects.insert(0, p);
        }
      } else {
        return c.state.clone();
      }
    }
    c.state.active_project_id = id;
    persist(c);
    c.state.clone()
  })
}

/// Insert or update a project (matched by id), keeping it at the front.
pub fn upsert_project(project: StudioProject) -> ProjectsState {
  with_cache(|c| {
    let mut project = project;
    if project.organization_id.is_none() {
      project.organization_id = c.settings.active_organization_id.clone();
    }
    c.state.projects.retain(|p| p.id != project.id);
    c.state.projects.insert(0, project);
    persist(c);
    c.state.clone()
  })
}

pub fn remove_project(id: &str) -> ProjectsState {
  with_cache(|c| {
    c.state.projects.retain(|p| p.id != id);
    if c.state.active_project_id.as_deref() == Some(id) {
      c.state.active_project_id = None;
    }
    persist(c);
    c.state.clone()
  })
}

/// Mutate a tracked project in place (id preserved) and persist.
pub fn mutate_project(id: &str, f: impl FnOnce(&mut StudioProject)) -> ProjectsState {
  with_cache(|c| {
    if let Some(p) = c.state.projects.iter_mut().find(|p| p.id == id) {
      let keep = p.id.clone();
      f(p);
      p.id = keep;
    }
    persist(c);
    c.state.clone()
  })
}

pub fn find_project(id: &str) -> Option<StudioProject> {
  with_cache(|c| c.state.projects.iter().find(|p| p.id == id).cloned())
}

/// The currently-active project (resolved from `active_project_id`), if any. Used
/// to locate the project-local Rayfin CLI for Fabric auth / REST calls.
pub fn active_project() -> Option<StudioProject> {
  with_cache(|c| {
    let id = c.state.active_project_id.clone()?;
    c.state.projects.iter().find(|p| p.id == id).cloned()
  })
}
