//! Minimal crash/error logging — the Rust counterpart to
//! `src/main/services/crashlog.ts`. Fatal errors (Rust panics) are appended to a
//! dated file under `<dataDir>/logs/`. Logging is local-only; nothing is sent.

use std::io::Write;

use super::paths;

fn log_file() -> std::path::PathBuf {
  let day = chrono::Utc::now().format("%Y-%m-%d").to_string();
  paths::logs_dir().join(format!("main-{day}.log"))
}

/// Append a labelled, timestamped error record; never panics.
pub fn log_error(label: &str, detail: &str) {
  let line = format!("[{}] {label}: {detail}\n", chrono::Utc::now().to_rfc3339());
  if let Ok(mut f) = std::fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(log_file())
  {
    let _ = f.write_all(line.as_bytes());
  }
  eprintln!("{}", line.trim_end());
}

/// Install a panic hook that records otherwise-fatal errors to the log file.
pub fn install_panic_hook() {
  let default = std::panic::take_hook();
  std::panic::set_hook(Box::new(move |info| {
    let detail = match info.location() {
      Some(loc) => format!("{info} (at {}:{})", loc.file(), loc.line()),
      None => format!("{info}"),
    };
    log_error("panic", &detail);
    default(info);
  }));
}
