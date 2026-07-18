//! Prepare isolated workspaces for converting non-Rayfin applications.
//!
//! The original folder/repository is never modified. A fresh bundled Rayfin
//! project is scaffolded in the configured workspace and receives a filtered,
//! dependency-free snapshot under `legacy-source/` for read-only analysis.

use std::path::{Path, PathBuf};

use tauri::AppHandle;

use crate::services::exec::{run, OnData, RunOptions, Stream};
use crate::services::{emit, store};
use crate::types::{CreateProjectInput, MigrationPrepareInput, ProjectActionResult};

const MIGRATION_TEMPLATE: &str = "fabricator-blankapp";
const SNAPSHOT_DIR: &str = "legacy-source";
const MIGRATION_SKILL: &str =
  include_str!("../../../resources/agent-skills/migrate-to-rayfin/SKILL.md");

fn failure(message: impl Into<String>) -> ProjectActionResult {
  ProjectActionResult {
    ok: false,
    error: Some(message.into()),
    project: None,
  }
}

fn say(on: &OnData, line: &str) {
  (**on)(Stream::Stdout, line);
}

fn source_name(kind: &str, source: &str) -> String {
  if kind == "folder" {
    return Path::new(source)
      .file_name()
      .map(|name| name.to_string_lossy().to_string())
      .unwrap_or_else(|| "Imported app".into());
  }
  source
    .trim_end_matches('/')
    .trim_end_matches(".git")
    .rsplit(['/', ':'])
    .next()
    .filter(|value| !value.trim().is_empty())
    .unwrap_or("Imported app")
    .to_string()
}

fn skip_directory(name: &str) -> bool {
  matches!(
    name.to_ascii_lowercase().as_str(),
    ".git"
      | "node_modules"
      | "dist"
      | "build"
      | ".next"
      | ".nuxt"
      | ".output"
      | "coverage"
      | "target"
      | ".turbo"
      | ".cache"
  )
}

fn skip_file(name: &str) -> bool {
  let lower = name.to_ascii_lowercase();
  if lower == ".ds_store" {
    return true;
  }
  if lower == ".env" || lower.starts_with(".env.") {
    return !lower.ends_with(".example")
      && !lower.ends_with(".sample")
      && !lower.ends_with(".template");
  }
  false
}

fn copy_snapshot(source: &Path, destination: &Path) -> std::io::Result<()> {
  std::fs::create_dir_all(destination)?;
  for entry in std::fs::read_dir(source)? {
    let entry = entry?;
    let name = entry.file_name();
    let name_text = name.to_string_lossy();
    let file_type = entry.file_type()?;
    if file_type.is_symlink() {
      continue;
    }
    if file_type.is_dir() {
      if skip_directory(&name_text) {
        continue;
      }
      copy_snapshot(&entry.path(), &destination.join(name))?;
    } else if file_type.is_file() && !skip_file(&name_text) {
      std::fs::copy(entry.path(), destination.join(name))?;
    }
  }
  Ok(())
}

fn remove_created_workspace(project_id: &str, project_path: &Path, workspace_root: &Path) {
  store::remove_project(project_id);
  let Ok(root) = workspace_root.canonicalize() else {
    return;
  };
  let Ok(target) = project_path.canonicalize() else {
    return;
  };
  // This command owns only the freshly-created child workspace. Never remove
  // the configured root itself or anything outside it.
  if target != root && target.starts_with(&root) {
    if let Err(error) = std::fs::remove_dir_all(&target) {
      log::warn!(
        "failed to roll back migration workspace {}: {error}",
        target.display()
      );
    }
  }
}

async fn commit_snapshot(project_path: &Path, on: &OnData) {
  let options = || RunOptions {
    cwd: Some(project_path.to_path_buf()),
    timeout_ms: Some(120_000),
    ..Default::default()
  };
  let add = run(
    "git",
    &[
      "add",
      "--",
      SNAPSHOT_DIR,
      ".vesperttine",
      ".agents/skills/migrate-to-rayfin",
    ],
    options(),
  )
  .await;
  if !add.ok {
    say(
      on,
      "Warning: the source snapshot could not be added to project history.\n",
    );
    return;
  }
  let commit = run(
    "git",
    &["commit", "-m", "Add protected migration source snapshot"],
    options(),
  )
  .await;
  if !commit.ok {
    say(
      on,
      "Warning: the source snapshot could not be committed to project history.\n",
    );
  }
}

/// Create an isolated Rayfin migration workspace from a GitHub repo or local folder.
#[tauri::command]
pub async fn migration_prepare(
  app: AppHandle,
  input: MigrationPrepareInput,
) -> ProjectActionResult {
  let kind = input.source_kind.trim().to_ascii_lowercase();
  if kind != "github" && kind != "folder" {
    return failure("Choose GitHub repository or local folder as the migration source.");
  }
  let source = input.source.trim().to_string();
  if source.is_empty() {
    return failure("Choose an application to migrate.");
  }
  let base_name = input
    .name
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(String::from)
    .unwrap_or_else(|| source_name(&kind, &source));
  let project_name = format!("{base_name} Rayfin");
  let workspace_root = PathBuf::from(store::get_state().workspace_root);
  let on = emit::proc_streamer(&app, "create:project");

  say(&on, "Creating an isolated Rayfin migration workspace...\n");
  let created = crate::commands::projects_impl::create_project(
    &app,
    CreateProjectInput {
      name: project_name,
      template: MIGRATION_TEMPLATE.into(),
      template_name: None,
    },
  )
  .await;
  let Some(project) = created.project else {
    return created;
  };
  let project_path = PathBuf::from(&project.path);
  let snapshot_path = project_path.join(SNAPSHOT_DIR);

  let snapshot_result: Result<(), String> = if kind == "github" {
    say(
      &on,
      "Cloning the source repository into the protected snapshot...\n",
    );
    let clone = run(
      "gh",
      &[
        "repo",
        "clone",
        source.as_str(),
        snapshot_path.to_string_lossy().as_ref(),
        "--",
        "--depth",
        "1",
      ],
      RunOptions {
        cwd: Some(project_path.clone()),
        on_data: Some(on.clone()),
        timeout_ms: Some(600_000),
        ..Default::default()
      },
    )
    .await;
    if clone.not_found {
      Err("GitHub CLI was not found. Install and sign in to GitHub, then try again.".into())
    } else if !clone.ok {
      Err("The repository could not be cloned. Check its URL and GitHub access.".into())
    } else {
      let git_dir = snapshot_path.join(".git");
      if git_dir.is_dir() {
        std::fs::remove_dir_all(&git_dir)
          .map_err(|error| format!("Could not detach the copied repository history: {error}"))
      } else {
        Ok(())
      }
    }
  } else {
    let source_path = PathBuf::from(&source);
    let canonical_source = match source_path.canonicalize() {
      Ok(path) if path.is_dir() => path,
      _ => {
        remove_created_workspace(&project.id, &project_path, &workspace_root);
        return failure("The selected source folder no longer exists.");
      }
    };
    let canonical_project = project_path
      .canonicalize()
      .unwrap_or_else(|_| project_path.clone());
    if canonical_project.starts_with(&canonical_source)
      || canonical_source.starts_with(&canonical_project)
    {
      Err("Choose a workspace outside the source application folder before migrating.".into())
    } else {
      say(
        &on,
        "Copying source files without dependencies, build output, Git history, or secrets...\n",
      );
      copy_snapshot(&canonical_source, &snapshot_path)
        .map_err(|error| format!("The source folder could not be copied: {error}"))
    }
  };

  if let Err(error) = snapshot_result {
    remove_created_workspace(&project.id, &project_path, &workspace_root);
    return failure(error);
  }

  let metadata_dir = project_path.join(".vesperttine");
  let skill_dir = project_path
    .join(".agents")
    .join("skills")
    .join("migrate-to-rayfin");
  if let Err(error) = std::fs::create_dir_all(&metadata_dir)
    .and_then(|_| std::fs::create_dir_all(&skill_dir))
    .and_then(|_| std::fs::write(skill_dir.join("SKILL.md"), MIGRATION_SKILL))
  {
    remove_created_workspace(&project.id, &project_path, &workspace_root);
    return failure(format!("Could not install the migration skill: {error}"));
  }

  let manifest = serde_json::json!({
    "version": 1,
    "status": "analysis-pending",
    "sourceKind": kind,
    "source": source,
    "snapshotPath": SNAPSHOT_DIR,
    "createdAt": chrono::Utc::now().to_rfc3339(),
    "rules": {
      "originalIsReadOnly": true,
      "preserveDatabaseNames": true,
      "deployOnlyAfterLocalTests": true
    }
  });
  if let Err(error) = std::fs::write(
    metadata_dir.join("migration.json"),
    serde_json::to_vec_pretty(&manifest).unwrap_or_default(),
  ) {
    remove_created_workspace(&project.id, &project_path, &workspace_root);
    return failure(format!("Could not save migration metadata: {error}"));
  }

  store::mutate_project(&project.id, |current| {
    current.template = Some("migration".into());
    current.awaiting_first_deploy = Some(false);
  });
  commit_snapshot(&project_path, &on).await;
  store::set_active(Some(project.id.clone()));
  say(
    &on,
    "\nMigration copy ready. Starting the assessment plan...\n",
  );

  ProjectActionResult {
    ok: true,
    error: None,
    project: store::find_project(&project.id),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn source_names_cover_repo_and_folder_inputs() {
    assert_eq!(source_name("github", "owner/lovable-app"), "lovable-app");
    assert_eq!(
      source_name("github", "https://github.com/owner/app.git"),
      "app"
    );
    assert_eq!(
      source_name("folder", "C:/apps/customer-portal"),
      "customer-portal"
    );
  }

  #[test]
  fn snapshots_skip_dependencies_outputs_git_and_secrets() {
    for name in [".git", "node_modules", "dist", ".next", "coverage"] {
      assert!(skip_directory(name), "{name} should be skipped");
    }
    assert!(skip_file(".env"));
    assert!(skip_file(".env.local"));
    assert!(!skip_file(".env.example"));
  }

  #[test]
  fn snapshot_copy_keeps_source_untouched_and_filters_generated_content() {
    let root = std::env::temp_dir().join(format!(
      "rayfin-migration-copy-{}-{}",
      std::process::id(),
      uuid::Uuid::new_v4()
    ));
    let source = root.join("source");
    let destination = root.join("snapshot");
    std::fs::create_dir_all(source.join("src")).unwrap();
    std::fs::create_dir_all(source.join("node_modules")).unwrap();
    std::fs::write(source.join("src").join("app.tsx"), "export default App").unwrap();
    std::fs::write(source.join("package.json"), "{}").unwrap();
    std::fs::write(source.join(".env"), "SECRET=value").unwrap();
    std::fs::write(source.join(".env.example"), "SECRET=").unwrap();
    std::fs::write(source.join("node_modules").join("ignored.js"), "x").unwrap();

    copy_snapshot(&source, &destination).unwrap();

    assert!(
      source.join(".env").is_file(),
      "source must remain untouched"
    );
    assert!(destination.join("src").join("app.tsx").is_file());
    assert!(destination.join("package.json").is_file());
    assert!(destination.join(".env.example").is_file());
    assert!(!destination.join(".env").exists());
    assert!(!destination.join("node_modules").exists());
    let _ = std::fs::remove_dir_all(root);
  }
}
