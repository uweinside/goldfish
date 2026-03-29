mod commands;
mod course_model;
mod course_store;

use std::ffi::OsStr;
use tauri::Manager;
use crate::course_store::CourseDirs;

/// Resolve course storage paths at app startup.
///
/// In debug (dev) builds we keep the CWD-based heuristic so the dev workflow
/// stays unchanged: courses live in `<repo>/courses/` and the old
/// `src-tauri/courses/` directory is checked as a read fallback.
///
/// In release builds `std::env::current_dir()` is unreliable (it may point to
/// `C:\Windows\System32` or the install directory, both of which are
/// read-only). We use Tauri's `app_local_data_dir()` instead, which resolves
/// to `%LOCALAPPDATA%\dev.cuepilot.goldfish\courses` — always writable.
fn resolve_course_dirs(app: &tauri::App) -> Result<CourseDirs, Box<dyn std::error::Error>> {
  if cfg!(debug_assertions) {
    let cwd = std::env::current_dir()?;
    let in_src_tauri = cwd.file_name() == Some(OsStr::new("src-tauri"));
    let primary = if in_src_tauri {
      cwd.parent().ok_or("src-tauri has no parent directory")?.join("courses")
    } else {
      cwd.join("courses")
    };
    let legacy = if in_src_tauri { Some(cwd.join("courses")) } else { None };
    Ok(CourseDirs { primary, legacy })
  } else {
    let primary = app.path().app_local_data_dir()?.join("courses");
    Ok(CourseDirs { primary, legacy: None })
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let dirs = resolve_course_dirs(app)?;
      std::fs::create_dir_all(&dirs.primary)
        .map_err(|e| format!("failed to create courses directory: {e}"))?;
      app.manage(dirs);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::list_local_courses,
      commands::load_local_course,
      commands::validate_course_document,
      commands::save_course_document,
      commands::delete_local_course,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
