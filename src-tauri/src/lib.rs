// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod git;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            git::open_repo,
            git::git_log,
            git::git_status,
            git::git_branches
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
