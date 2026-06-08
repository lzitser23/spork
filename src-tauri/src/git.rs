//! Thin wrappers around the system `git` CLI.
//!
//! Each command shells out to `git`, parses its porcelain output, and returns
//! serde-serializable structs that the React frontend consumes via `invoke()`.

use serde::Serialize;
use std::path::Path;
use std::process::Command;

/// ASCII unit separator — used between fields in our custom `--pretty`/`--format`
/// strings because it can't appear in branch names, hashes, emails, or subjects.
const US: char = '\u{1f}';
/// ASCII record separator — used between commits.
const RS: char = '\u{1e}';

#[derive(Serialize)]
pub struct RepoInfo {
    /// Absolute path to the repository's top level.
    pub path: String,
    /// Folder name of the top level (shown in the title bar / header).
    pub name: String,
    /// Current branch, or "(detached)".
    pub branch: String,
    /// Short hash of HEAD (empty for a repo with no commits yet).
    pub head: String,
}

#[derive(Serialize)]
pub struct Commit {
    pub hash: String,
    pub short_hash: String,
    pub author_name: String,
    pub author_email: String,
    /// Author date as a Unix timestamp (seconds).
    pub timestamp: i64,
    pub subject: String,
}

#[derive(Serialize)]
pub struct StatusEntry {
    /// Staged (index) status char from `git status --porcelain`.
    pub x: String,
    /// Unstaged (work tree) status char.
    pub y: String,
    pub path: String,
}

#[derive(Serialize)]
pub struct Branch {
    pub name: String,
    pub is_current: bool,
    pub upstream: Option<String>,
}

/// Run `git <args>` inside `repo` and return stdout, or stderr as the error.
fn run_git(repo: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(repo)
        .args(args)
        .output()
        .map_err(|e| format!("failed to launch git: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if err.is_empty() {
            format!("git {} failed", args.join(" "))
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Resolve the work-tree root for a user-selected path.
///
/// `--show-toplevel` works from any subdirectory of a repo, so the user can pick
/// a nested folder and we still find the root. If they picked the `.git`
/// directory itself, retry from its parent.
fn resolve_toplevel(path: &str) -> Result<String, String> {
    if let Ok(top) = run_git(path, &["rev-parse", "--show-toplevel"]) {
        let top = top.trim();
        if !top.is_empty() {
            return Ok(top.to_string());
        }
    }
    let p = Path::new(path);
    if p.file_name().map(|n| n == ".git").unwrap_or(false) {
        if let Some(parent) = p.parent() {
            if let Ok(top) = run_git(&parent.to_string_lossy(), &["rev-parse", "--show-toplevel"]) {
                let top = top.trim();
                if !top.is_empty() {
                    return Ok(top.to_string());
                }
            }
        }
    }
    Err("Not a Git repository — pick the project folder that contains .git, not .git itself".into())
}

/// Validate that `path` is a Git work tree and return basic info about it.
#[tauri::command]
pub fn open_repo(path: String) -> Result<RepoInfo, String> {
    let top = resolve_toplevel(&path)?;

    let branch_raw = run_git(&top, &["branch", "--show-current"]).unwrap_or_default();
    let branch = {
        let b = branch_raw.trim();
        if b.is_empty() {
            "(detached)".to_string()
        } else {
            b.to_string()
        }
    };

    let head = run_git(&top, &["rev-parse", "--short", "HEAD"])
        .unwrap_or_default()
        .trim()
        .to_string();

    let name = Path::new(&top)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| top.clone());

    Ok(RepoInfo {
        path: top,
        name,
        branch,
        head,
    })
}

/// Return up to `limit` (default 200) most-recent commits reachable from HEAD.
#[tauri::command]
pub fn git_log(path: String, limit: Option<usize>) -> Result<Vec<Commit>, String> {
    // Newly-initialized repo with no commits yet (unborn HEAD): return empty history.
    if run_git(&path, &["rev-parse", "--verify", "--quiet", "HEAD"]).is_err() {
        return Ok(Vec::new());
    }
    let n = limit.unwrap_or(200).to_string();
    let fmt = format!("--pretty=format:%H{US}%h{US}%an{US}%ae{US}%at{US}%s{RS}");
    let out = run_git(&path, &["log", "-n", &n, &fmt])?;

    let mut commits = Vec::new();
    for record in out.split(RS) {
        let rec = record.trim_matches(|c| c == '\n' || c == '\r');
        if rec.is_empty() {
            continue;
        }
        let f: Vec<&str> = rec.split(US).collect();
        if f.len() < 6 {
            continue;
        }
        commits.push(Commit {
            hash: f[0].to_string(),
            short_hash: f[1].to_string(),
            author_name: f[2].to_string(),
            author_email: f[3].to_string(),
            timestamp: f[4].parse().unwrap_or(0),
            subject: f[5].to_string(),
        });
    }
    Ok(commits)
}

/// Return the working-tree status (staged + unstaged changes).
#[tauri::command]
pub fn git_status(path: String) -> Result<Vec<StatusEntry>, String> {
    let out = run_git(&path, &["status", "--porcelain"])?;

    let mut entries = Vec::new();
    for line in out.lines() {
        // Format is "XY PATH"; first two bytes are the status code, then a space.
        if line.len() < 4 {
            continue;
        }
        entries.push(StatusEntry {
            x: line[0..1].to_string(),
            y: line[1..2].to_string(),
            path: line[3..].to_string(),
        });
    }
    Ok(entries)
}

/// Return the local branches, marking the current one and its upstream.
#[tauri::command]
pub fn git_branches(path: String) -> Result<Vec<Branch>, String> {
    let fmt = format!("--format=%(HEAD){US}%(refname:short){US}%(upstream:short)");
    let out = run_git(&path, &["for-each-ref", &fmt, "refs/heads"])?;

    let mut branches = Vec::new();
    for line in out.lines() {
        let f: Vec<&str> = line.split(US).collect();
        if f.len() < 2 {
            continue;
        }
        branches.push(Branch {
            is_current: f[0] == "*",
            name: f[1].to_string(),
            upstream: f.get(2).filter(|s| !s.is_empty()).map(|s| s.to_string()),
        });
    }
    Ok(branches)
}
