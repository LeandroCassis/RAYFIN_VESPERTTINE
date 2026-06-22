//! Skills catalog (list/toggle/source). Ported from
//! `src/main/services/skills.ts` in a later phase.

use crate::types::{SkillActionResult, SkillInfo, SkillSource};

const PENDING: &str = "Skills are being ported to the Tauri build.";

#[tauri::command]
pub async fn skills_list(_id: String) -> Vec<SkillInfo> {
  vec![]
}

#[tauri::command]
pub async fn skills_set(_id: String, _skill_id: String, _active: bool) -> SkillActionResult {
  SkillActionResult {
    ok: false,
    skills: vec![],
    error: Some(PENDING.to_string()),
  }
}

#[tauri::command]
pub async fn skills_source(_id: String, _skill_id: String) -> SkillSource {
  SkillSource {
    ok: false,
    installed: false,
    content: None,
    error: Some(PENDING.to_string()),
  }
}
