use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

const REPO_CHANGED_EVENT: &str = "repo_changed";
const DEBOUNCE: Duration = Duration::from_millis(600);
const IDLE_POLL: Duration = Duration::from_millis(250);

#[derive(Default)]
pub struct RepoWatchState {
    current: Mutex<Option<RepoWatch>>,
}

struct RepoWatch {
    path: String,
    _watcher: RecommendedWatcher,
    stop_tx: mpsc::Sender<()>,
}

impl Drop for RepoWatch {
    fn drop(&mut self) {
        let _ = self.stop_tx.send(());
    }
}

#[derive(Clone, Serialize)]
struct RepoChangedPayload {
    path: String,
}

#[tauri::command]
pub fn start_repo_watch(
    path: String,
    app: AppHandle,
    state: State<'_, RepoWatchState>,
) -> Result<(), String> {
    let info = crate::git::open_repo(path)?;
    let repo_path = info.path;

    let mut current = state.current.lock().map_err(|e| e.to_string())?;
    if current.as_ref().map(|w| w.path.as_str()) == Some(repo_path.as_str()) {
        return Ok(());
    }

    current.take();
    let watch = RepoWatch::new(PathBuf::from(&repo_path), app)?;
    *current = Some(watch);
    Ok(())
}

#[tauri::command]
pub fn stop_repo_watch(state: State<'_, RepoWatchState>) -> Result<(), String> {
    let mut current = state.current.lock().map_err(|e| e.to_string())?;
    current.take();
    Ok(())
}

impl RepoWatch {
    fn new(repo_root: PathBuf, app: AppHandle) -> Result<Self, String> {
        let path = repo_root.to_string_lossy().into_owned();
        let (event_tx, event_rx) = mpsc::channel();
        let (stop_tx, stop_rx) = mpsc::channel();

        let mut watcher = RecommendedWatcher::new(
            move |result: notify::Result<Event>| {
                let _ = event_tx.send(result);
            },
            Config::default(),
        )
        .map_err(|e| format!("failed to create repo watcher: {e}"))?;

        watcher
            .watch(&repo_root, RecursiveMode::Recursive)
            .map_err(|e| format!("failed to watch repository: {e}"))?;

        spawn_debounced_emitter(app, path.clone(), event_rx, stop_rx);

        Ok(Self {
            path,
            _watcher: watcher,
            stop_tx,
        })
    }
}

fn spawn_debounced_emitter(
    app: AppHandle,
    repo_path: String,
    event_rx: mpsc::Receiver<notify::Result<Event>>,
    stop_rx: mpsc::Receiver<()>,
) {
    thread::spawn(move || {
        let mut pending = false;
        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            let timeout = if pending { DEBOUNCE } else { IDLE_POLL };
            match event_rx.recv_timeout(timeout) {
                Ok(Ok(event)) => {
                    if event.paths.is_empty() || event.paths.iter().any(|p| !is_noisy_path(p)) {
                        pending = true;
                    }
                }
                Ok(Err(_)) => {
                    pending = true;
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if pending {
                        let _ = app.emit(
                            REPO_CHANGED_EVENT,
                            RepoChangedPayload {
                                path: repo_path.clone(),
                            },
                        );
                        pending = false;
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });
}

fn is_noisy_path(path: &Path) -> bool {
    let mut inside_git = false;
    let mut last_was_git_dir = false;
    for component in path.components() {
        let Component::Normal(part) = component else {
            continue;
        };
        let name = part.to_string_lossy().to_ascii_lowercase();
        last_was_git_dir = false;

        if inside_git {
            // Pure-noise directories.
            if matches!(name.as_str(), "objects" | "logs" | "hooks") {
                return true;
            }
            // Files a refresh itself rewrites — `git status` rewrites `.git/index`
            // on every load, so reacting to it would loop forever — plus transient
            // locks and per-operation metadata. Real ref/HEAD changes still pass.
            if name.ends_with(".lock")
                || matches!(name.as_str(), "index" | "fetch_head" | "orig_head" | "commit_editmsg")
            {
                return true;
            }
        }

        if name == ".git" {
            inside_git = true;
            last_was_git_dir = true;
            continue;
        }

        if matches!(
            name.as_str(),
            "node_modules" | "target" | "dist" | "build" | ".next" | ".vite" | "coverage"
        ) {
            return true;
        }
    }
    // A bare event on the `.git` directory itself (path ends at `.git`, no child)
    // is just its entry list churning as `git status` rewrites `.git/index` on
    // every load — Windows surfaces this as a directory event, and reacting to it
    // re-triggers the reload endlessly. Real ref/HEAD changes arrive as
    // `.git/<child>` (HEAD, refs/…, packed-refs) and still pass.
    last_was_git_dir
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    #[test]
    fn noisy_generated_paths_are_filtered() {
        assert!(super::is_noisy_path(Path::new(
            r"D:\repo\node_modules\pkg\index.js"
        )));
        assert!(super::is_noisy_path(Path::new(
            r"D:\repo\.git\objects\pack\pack.idx"
        )));
        assert!(super::is_noisy_path(Path::new(
            r"D:\repo\target\debug\app.exe"
        )));
        assert!(super::is_noisy_path(Path::new(
            r"D:\repo\dist\assets\index.js"
        )));
    }

    #[test]
    fn transient_git_files_are_filtered() {
        // `git status` rewrites the index on every load — reacting would loop.
        assert!(super::is_noisy_path(Path::new(r"D:\repo\.git\index")));
        assert!(super::is_noisy_path(Path::new(r"D:\repo\.git\index.lock")));
        assert!(super::is_noisy_path(Path::new(r"D:\repo\.git\FETCH_HEAD")));
        assert!(super::is_noisy_path(Path::new(
            r"D:\repo\.git\refs\heads\main.lock"
        )));
    }

    #[test]
    fn source_and_git_ref_paths_are_not_filtered() {
        assert!(!super::is_noisy_path(Path::new(r"D:\repo\src\App.tsx")));
        assert!(!super::is_noisy_path(Path::new(r"D:\repo\.git\HEAD")));
        assert!(!super::is_noisy_path(Path::new(
            r"D:\repo\.git\refs\heads\main"
        )));
        assert!(!super::is_noisy_path(Path::new(
            r"D:\repo\.git\packed-refs"
        )));
    }

    #[test]
    fn bare_git_directory_event_is_filtered() {
        // Windows reports a change on the `.git` dir itself as its entries churn
        // during a status refresh; reacting would loop on every reload.
        assert!(super::is_noisy_path(Path::new(r"D:\repo\.git")));
    }
}
