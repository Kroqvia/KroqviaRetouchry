pub mod commands;
pub mod models;
pub mod pipeline;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::validate_path,
            commands::open_image,
            commands::render_preview,
            commands::export_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KroqviaRetouchry application");
}
