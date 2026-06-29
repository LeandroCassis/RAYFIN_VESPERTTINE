//! Main-thread hang watchdog.
//!
//! Some users (notably under Parallels/VMs) report the app freezing. To make
//! such hangs observable in the field, the Tauri event loop bumps a heartbeat on
//! every iteration via [`beat`], and a background thread checks it: when the main
//! thread hasn't ticked for longer than [`STALL_THRESHOLD`], it records a single
//! "main thread stalled" entry to the crash log (local-only, no network). It logs
//! once per stall and again when responsiveness returns, so logs aren't flooded.

use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::time::Duration;

use super::crashlog;

/// Epoch-millis of the last event-loop tick; 0 until the first beat.
static LAST_BEAT_MS: AtomicI64 = AtomicI64::new(0);
/// Whether we're currently inside a logged stall (so we log start/end once each).
static STALLED: AtomicBool = AtomicBool::new(false);

/// Longest the main thread may go between ticks before we treat it as hung. The
/// bounded preview capture caps a legitimate UI-thread block at ~5s, so 10s only
/// fires on a genuine freeze.
const STALL_THRESHOLD: Duration = Duration::from_secs(10);
/// How often the monitor thread wakes to check the heartbeat.
const POLL_INTERVAL: Duration = Duration::from_secs(2);

fn now_ms() -> i64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

/// Record a main-thread tick. Cheap enough to call on every event-loop iteration.
pub fn beat() {
  LAST_BEAT_MS.store(now_ms(), Ordering::Relaxed);
}

/// Spawn the monitor thread once. The thread is detached and lives for the app's
/// lifetime; it never touches the UI, only reads the heartbeat and logs.
pub fn start() {
  beat();
  std::thread::Builder::new()
    .name("hang-watchdog".into())
    .spawn(|| loop {
      std::thread::sleep(POLL_INTERVAL);
      let last = LAST_BEAT_MS.load(Ordering::Relaxed);
      if last == 0 {
        continue; // event loop hasn't started ticking yet
      }
      let lag = now_ms() - last;
      if lag >= STALL_THRESHOLD.as_millis() as i64 {
        if !STALLED.swap(true, Ordering::SeqCst) {
          crashlog::log_error("hang", &format!("main thread stalled for ~{lag}ms"));
        }
      } else if STALLED.swap(false, Ordering::SeqCst) {
        crashlog::log_error("hang", &format!("main thread recovered after ~{lag}ms"));
      }
    })
    .ok();
}
