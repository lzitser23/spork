// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod git;
mod watch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(watch::RepoWatchState::default())
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
            git::read_image,
            git::git_stash,
            git::working_diff,
            git::git_checkout,
            git::git_stage,
            git::git_unstage,
            git::git_stage_all,
            git::git_unstage_all,
            git::git_commit,
            git::git_commit_all,
            git::git_create_branch,
            git::git_delete_branch,
            git::git_remote_branches,
            git::git_remote_tips,
            git::add_to_gitignore,
            git::git_stash_pop,
            git::git_stash_apply,
            git::git_stash_drop,
            git::git_create_tag,
            git::git_delete_tag,
            git::git_remove_remote,
            git::git_submodules,
            git::git_submodule_update,
            watch::start_repo_watch,
            watch::stop_repo_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
