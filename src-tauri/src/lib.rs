mod commands;
mod course_model;
mod course_store;

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
