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
            git::git_branches,
            git::git_remotes,
            git::git_tags,
            git::git_stashes,
            git::commit_details,
            git::commit_files,
            git::file_diff,
            git::git_fetch,
            git::git_pull,
            git::git_push,
            git::git_clone,
            git::git_add_remote,
            git::list_files,
            git::read_file,
            git::git_stash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
