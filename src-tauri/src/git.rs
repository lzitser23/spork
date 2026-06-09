//! Thin wrappers around the system `git` CLI.
//!
//! Each command shells out to `git`, parses its porcelain/format output, and
//! returns serde-serializable structs that the React frontend consumes via
//! `invoke()`.

use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

/// ASCII unit separator — used between fields in our custom format strings
/// because it can't appear in branch names, hashes, emails, or subjects.
const US: char = '\u{1f}';
/// ASCII record separator — used between records (e.g. commits).
const RS: char = '\u{1e}';

#[derive(Serialize)]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub branch: String,
    pub head: String,
}

/// A ref pointing at a commit (for the colored pills next to commits).
#[derive(Serialize)]
pub struct RefBadge {
    pub name: String,
    /// "head" (current branch), "branch", "remote", or "tag".
    pub kind: String,
}

#[derive(Serialize)]
pub struct Commit {
    pub hash: String,
    pub short_hash: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub subject: String,
    /// Parent commit hashes (full). Empty for the root; >1 for a merge.
    pub parents: Vec<String>,
    pub refs: Vec<RefBadge>,
}

#[derive(Serialize)]
pub struct StatusEntry {
    pub x: String,
    pub y: String,
    pub path: String,
}

#[derive(Serialize)]
pub struct Branch {
    pub name: String,
    pub is_current: bool,
    pub upstream: Option<String>,
}

#[derive(Serialize)]
pub struct Remote {
    pub name: String,
    pub url: String,
}

#[derive(Serialize)]
pub struct Stash {
    pub index: usize,
    pub reff: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct Person {
    pub name: String,
    pub email: String,
    pub timestamp: i64,
}

#[derive(Serialize)]
pub struct CommitDetails {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    pub author: Person,
    pub committer: Person,
    pub subject: String,
    pub body: String,
}

#[derive(Serialize)]
pub struct FileChange {
    /// Single-letter status: A, M, D, R, C, T.
    pub status: String,
    pub path: String,
    pub additions: i64,
    pub deletions: i64,
    pub binary: bool,
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

/// Like [`run_git`], but tolerant of exit code 1 — which `git diff` (and
/// `git diff --no-index`) use to mean "there were differences", not failure.
fn run_git_diff(repo: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(repo)
        .args(args)
        .output()
        .map_err(|e| format!("failed to launch git: {e}"))?;
    match output.status.code() {
        Some(0) | Some(1) => Ok(String::from_utf8_lossy(&output.stdout).into_owned()),
        _ => {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(if err.is_empty() {
                format!("git {} failed", args.join(" "))
            } else {
                err
            })
        }
    }
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

/// Turn a `%D` decoration string ("HEAD -> main, origin/main, tag: v1") into badges.
fn parse_refs(decoration: &str) -> Vec<RefBadge> {
    let mut out = Vec::new();
    for raw in decoration.split(", ") {
        let raw = raw.trim();
        if raw.is_empty() {
            continue;
        }
        if let Some(rest) = raw.strip_prefix("HEAD -> ") {
            out.push(RefBadge { name: rest.to_string(), kind: "head".into() });
        } else if raw == "HEAD" {
            out.push(RefBadge { name: "HEAD".into(), kind: "head".into() });
        } else if let Some(tag) = raw.strip_prefix("tag: ") {
            out.push(RefBadge { name: tag.to_string(), kind: "tag".into() });
        } else if raw.contains('/') {
            out.push(RefBadge { name: raw.to_string(), kind: "remote".into() });
        } else {
            out.push(RefBadge { name: raw.to_string(), kind: "branch".into() });
        }
    }
    out
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

    Ok(RepoInfo { path: top, name, branch, head })
}

/// Return up to `limit` (default 200) most-recent commits reachable from HEAD.
#[tauri::command]
pub fn git_log(path: String, limit: Option<usize>) -> Result<Vec<Commit>, String> {
    // Newly-initialized repo with no commits yet (unborn HEAD): return empty history.
    if run_git(&path, &["rev-parse", "--verify", "--quiet", "HEAD"]).is_err() {
        return Ok(Vec::new());
    }

    let n = limit.unwrap_or(200).to_string();
    let fmt = format!("--pretty=format:%H{US}%h{US}%an{US}%ae{US}%at{US}%P{US}%D{US}%s{RS}");
    // `--date-order` keeps commits in commit-date order while still guaranteeing
    // that no parent is shown before all of its children — exactly the ordering
    // the lane-assignment algorithm relies on for a clean graph.
    let out = run_git(&path, &["log", "--date-order", "-n", &n, &fmt])?;

    let mut commits = Vec::new();
    for record in out.split(RS) {
        let rec = record.trim_matches(|c| c == '\n' || c == '\r');
        if rec.is_empty() {
            continue;
        }
        let f: Vec<&str> = rec.split(US).collect();
        if f.len() < 8 {
            continue;
        }
        commits.push(Commit {
            hash: f[0].to_string(),
            short_hash: f[1].to_string(),
            author_name: f[2].to_string(),
            author_email: f[3].to_string(),
            timestamp: f[4].parse().unwrap_or(0),
            parents: f[5].split_whitespace().map(|s| s.to_string()).collect(),
            refs: parse_refs(f[6]),
            subject: f[7].to_string(),
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
            upstream: f.get(2).copied().filter(|s| !s.is_empty()).map(|s| s.to_string()),
        });
    }
    Ok(branches)
}

/// Configured remotes (deduped to one fetch URL each).
#[tauri::command]
pub fn git_remotes(path: String) -> Result<Vec<Remote>, String> {
    let out = run_git(&path, &["remote", "-v"])?;
    let mut seen: HashMap<String, String> = HashMap::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[2] == "(fetch)" {
            seen.entry(parts[0].to_string()).or_insert_with(|| parts[1].to_string());
        }
    }
    let mut v: Vec<Remote> = seen.into_iter().map(|(name, url)| Remote { name, url }).collect();
    v.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(v)
}

/// Tags, newest first.
#[tauri::command]
pub fn git_tags(path: String) -> Result<Vec<String>, String> {
    let out = run_git(&path, &["tag", "--sort=-creatordate"])?;
    Ok(out
        .lines()
        .filter(|l| !l.trim().is_empty())
        .take(200)
        .map(|s| s.to_string())
        .collect())
}

/// Stash entries.
#[tauri::command]
pub fn git_stashes(path: String) -> Result<Vec<Stash>, String> {
    let fmt = format!("--format=%gd{US}%gs");
    let out = run_git(&path, &["stash", "list", &fmt])?;
    let mut v = Vec::new();
    for (i, line) in out.lines().enumerate() {
        let f: Vec<&str> = line.split(US).collect();
        if f.is_empty() || f[0].is_empty() {
            continue;
        }
        v.push(Stash {
            index: i,
            reff: f[0].to_string(),
            message: f.get(1).copied().unwrap_or("").to_string(),
        });
    }
    Ok(v)
}

/// Full metadata for a single commit.
#[tauri::command]
pub fn commit_details(path: String, hash: String) -> Result<CommitDetails, String> {
    let fmt = format!(
        "--format=%H{US}%h{US}%P{US}%an{US}%ae{US}%at{US}%cn{US}%ce{US}%ct{US}%s{US}%b"
    );
    let out = run_git(&path, &["show", "-s", &fmt, &hash])?;
    let f: Vec<&str> = out.split(US).collect();
    if f.len() < 11 {
        return Err("unexpected git output for commit".into());
    }
    let parents = f[2].split_whitespace().map(|s| s.to_string()).collect();
    Ok(CommitDetails {
        hash: f[0].to_string(),
        short_hash: f[1].to_string(),
        parents,
        author: Person {
            name: f[3].to_string(),
            email: f[4].to_string(),
            timestamp: f[5].parse().unwrap_or(0),
        },
        committer: Person {
            name: f[6].to_string(),
            email: f[7].to_string(),
            timestamp: f[8].parse().unwrap_or(0),
        },
        subject: f[9].to_string(),
        body: f[10].trim_end().to_string(),
    })
}

/// Files changed by a commit, with +/- line counts.
#[tauri::command]
pub fn commit_files(path: String, hash: String) -> Result<Vec<FileChange>, String> {
    // `-m --first-parent` makes merge commits show their diff against the first
    // parent (otherwise diff-tree yields nothing for a merge); harmless for
    // ordinary commits. `--root` covers the initial commit.
    let numstat = run_git(
        &path,
        &["diff-tree", "--no-commit-id", "-r", "-M", "-m", "--first-parent", "--root", "--numstat", &hash],
    )?;
    let mut nums: HashMap<String, (i64, i64, bool)> = HashMap::new();
    for line in numstat.lines() {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 3 {
            continue;
        }
        let binary = cols[0] == "-";
        let adds: i64 = cols[0].parse().unwrap_or(0);
        let dels: i64 = cols[1].parse().unwrap_or(0);
        let key = cols[cols.len() - 1].to_string();
        nums.insert(key, (adds, dels, binary));
    }

    let name_status = run_git(
        &path,
        &["diff-tree", "--no-commit-id", "-r", "-M", "-m", "--first-parent", "--root", "--name-status", &hash],
    )?;
    let mut out = Vec::new();
    for line in name_status.lines() {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 2 {
            continue;
        }
        let status = cols[0].chars().next().unwrap_or('?').to_string();
        let file = cols[cols.len() - 1].to_string();
        let (additions, deletions, binary) = nums.get(&file).copied().unwrap_or((0, 0, false));
        out.push(FileChange { status, path: file, additions, deletions, binary });
    }
    Ok(out)
}

/// The unified diff (patch) for a single file in a commit.
#[tauri::command]
pub fn file_diff(path: String, hash: String, file: String) -> Result<String, String> {
    // `-m --first-parent` so a file's diff inside a merge commit resolves against
    // the first parent (matching the merge file list); a no-op for normal commits.
    run_git(&path, &["show", "--format=", "-M", "-m", "--first-parent", &hash, "--", &file])
}

/// The working-tree diff for a single file: everything that differs from HEAD
/// (staged and unstaged combined). Untracked files render as all-additions.
#[tauri::command]
pub fn working_diff(path: String, file: String) -> Result<String, String> {
    // A staged rename appears in status as "old -> new"; diff the new path.
    let file = file.rsplit(" -> ").next().unwrap_or(&file).to_string();

    let tracked = run_git(&path, &["ls-files", "--error-unmatch", "--", &file]).is_ok();
    if !tracked {
        // Untracked: diff against the empty file so the whole thing reads as added.
        return run_git_diff(&path, &["diff", "--no-index", "--", "/dev/null", &file]);
    }
    let has_head = run_git(&path, &["rev-parse", "--verify", "--quiet", "HEAD"]).is_ok();
    if has_head {
        run_git_diff(&path, &["diff", "HEAD", "--", &file])
    } else {
        // Unborn HEAD (no commits yet): the only diff is what's staged.
        run_git_diff(&path, &["diff", "--cached", "--", &file])
    }
}

/// Fetch from all remotes (prunes deleted branches).
#[tauri::command]
pub fn git_fetch(path: String) -> Result<String, String> {
    run_git(&path, &["fetch", "--all", "--prune"])
}

/// Fast-forward pull.
#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    run_git(&path, &["pull", "--ff-only"])
}

/// Push the current branch. If it has no upstream yet (e.g. a branch just
/// created locally), publish it to `origin` and set up tracking.
#[tauri::command]
pub fn git_push(path: String) -> Result<String, String> {
    let has_upstream = run_git(
        &path,
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    )
    .is_ok();
    if has_upstream {
        run_git(&path, &["push"])
    } else {
        run_git(&path, &["push", "-u", "origin", "HEAD"])
    }
}

/// Stash the working-tree changes (`git stash`).
#[tauri::command]
pub fn git_stash(path: String) -> Result<String, String> {
    run_git(&path, &["stash"])
}

/// Switch to an existing branch (or any ref). Fails if local changes would be
/// overwritten — that error is surfaced to the UI.
#[tauri::command]
pub fn git_checkout(path: String, name: String) -> Result<String, String> {
    run_git(&path, &["checkout", &name])
}

/// Stage one path (`git add` — handles new, modified, and deleted files).
#[tauri::command]
pub fn git_stage(path: String, file: String) -> Result<String, String> {
    let file = file.rsplit(" -> ").next().unwrap_or(&file).to_string();
    run_git(&path, &["add", "--", &file])
}

/// Stage everything (tracked edits, deletions, and untracked files).
#[tauri::command]
pub fn git_stage_all(path: String) -> Result<String, String> {
    run_git(&path, &["add", "-A"])
}

/// Unstage one path.
#[tauri::command]
pub fn git_unstage(path: String, file: String) -> Result<String, String> {
    let file = file.rsplit(" -> ").next().unwrap_or(&file).to_string();
    if run_git(&path, &["rev-parse", "--verify", "--quiet", "HEAD"]).is_ok() {
        run_git(&path, &["reset", "-q", "HEAD", "--", &file])
    } else {
        // Unborn HEAD: nothing to reset against — just drop it from the index.
        run_git(&path, &["rm", "-q", "--cached", "--", &file])
    }
}

/// Unstage everything.
#[tauri::command]
pub fn git_unstage_all(path: String) -> Result<String, String> {
    if run_git(&path, &["rev-parse", "--verify", "--quiet", "HEAD"]).is_ok() {
        run_git(&path, &["reset", "-q"])
    } else {
        run_git(&path, &["rm", "-q", "--cached", "-r", "--", "."])
    }
}

/// Commit the staged changes. Author identity comes from the user's git config;
/// an empty message or empty index makes git error, which surfaces to the UI.
#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<String, String> {
    run_git(&path, &["commit", "-m", &message])
}

/// Create a new branch from the current HEAD and switch to it.
#[tauri::command]
pub fn git_create_branch(path: String, name: String) -> Result<String, String> {
    run_git(&path, &["checkout", "-b", &name])
}

/// Delete a branch. `force` uses `-D` (drops unmerged work); otherwise `-d`
/// refuses to delete a branch that isn't fully merged.
#[tauri::command]
pub fn git_delete_branch(path: String, name: String, force: bool) -> Result<String, String> {
    let flag = if force { "-D" } else { "-d" };
    run_git(&path, &["branch", flag, &name])
}

/// Remote-tracking branches (e.g. `origin/main`), excluding the `*/HEAD` alias.
#[tauri::command]
pub fn git_remote_branches(path: String) -> Result<Vec<String>, String> {
    let out = run_git(&path, &["for-each-ref", "--format=%(refname:short)", "refs/remotes"])?;
    Ok(out
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.ends_with("/HEAD"))
        .map(|s| s.to_string())
        .collect())
}

/// Stage everything, then commit — the one-shot path for committing unstaged /
/// untracked changes directly without staging them first.
#[tauri::command]
pub fn git_commit_all(path: String, message: String) -> Result<String, String> {
    run_git(&path, &["add", "-A"])?;
    run_git(&path, &["commit", "-m", &message])
}

/// Append a path to the repo's `.gitignore` (creating it if needed), skipping
/// duplicates. Returns the entry written.
#[tauri::command]
pub fn add_to_gitignore(path: String, file: String) -> Result<String, String> {
    // A staged rename shows up as "old -> new"; ignore the new path.
    let file = file.rsplit(" -> ").next().unwrap_or(&file).to_string();
    let entry = file.trim();
    if entry.is_empty() {
        return Err("nothing to ignore".into());
    }
    let gitignore = Path::new(&path).join(".gitignore");
    let existing = std::fs::read_to_string(&gitignore).unwrap_or_default();
    if existing.lines().any(|l| l.trim() == entry) {
        return Ok(entry.to_string()); // already ignored
    }
    let mut content = existing;
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(entry);
    content.push('\n');
    std::fs::write(&gitignore, content).map_err(|e| e.to_string())?;
    Ok(entry.to_string())
}

/// Pop a stash (apply it and drop it).
#[tauri::command]
pub fn git_stash_pop(path: String, reff: String) -> Result<String, String> {
    run_git(&path, &["stash", "pop", &reff])
}

/// Apply a stash, keeping it in the stash list.
#[tauri::command]
pub fn git_stash_apply(path: String, reff: String) -> Result<String, String> {
    run_git(&path, &["stash", "apply", &reff])
}

/// Drop (delete) a stash without applying it.
#[tauri::command]
pub fn git_stash_drop(path: String, reff: String) -> Result<String, String> {
    run_git(&path, &["stash", "drop", &reff])
}

/// Create a lightweight tag at HEAD.
#[tauri::command]
pub fn git_create_tag(path: String, name: String) -> Result<String, String> {
    run_git(&path, &["tag", &name])
}

/// Delete a tag.
#[tauri::command]
pub fn git_delete_tag(path: String, name: String) -> Result<String, String> {
    run_git(&path, &["tag", "-d", &name])
}

/// Remove a configured remote.
#[tauri::command]
pub fn git_remove_remote(path: String, name: String) -> Result<String, String> {
    run_git(&path, &["remote", "remove", &name])
}

/// Submodule paths (second column of `git submodule status`); empty if none.
#[tauri::command]
pub fn git_submodules(path: String) -> Result<Vec<String>, String> {
    let out = run_git(&path, &["submodule", "status"])?;
    Ok(out
        .lines()
        .filter_map(|l| l.split_whitespace().nth(1).map(String::from))
        .collect())
}

/// Initialize and update all submodules recursively.
#[tauri::command]
pub fn git_submodule_update(path: String) -> Result<String, String> {
    run_git(&path, &["submodule", "update", "--init", "--recursive"])
}

/// Clone `url` into a new folder under `parent_dir`; returns the new repo path.
///
/// Authentication is delegated to the system git's credential helper (e.g. Git
/// Credential Manager on Windows), so private GitHub repos trigger the normal
/// browser sign-in / stored token — Spork never handles credentials itself.
#[tauri::command]
pub fn git_clone(url: String, parent_dir: String) -> Result<String, String> {
    let name = url
        .trim()
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("repo")
        .trim_end_matches(".git");
    let name = if name.is_empty() { "repo" } else { name };
    let target = Path::new(&parent_dir).join(name);
    let target_str = target.to_string_lossy().into_owned();
    run_git(&parent_dir, &["clone", &url, &target_str])?;
    Ok(target_str)
}

/// Add a remote (e.g. `origin` -> a GitHub URL) to an existing repo.
#[tauri::command]
pub fn git_add_remote(path: String, name: String, url: String) -> Result<String, String> {
    run_git(&path, &["remote", "add", &name, &url])
}

/// Contents of a working-tree file for the file browser.
#[derive(Serialize)]
pub struct FileContent {
    pub text: String,
    pub binary: bool,
    pub too_large: bool,
    pub size: u64,
}

/// List all tracked files (respects .gitignore) for the file tree.
#[tauri::command]
pub fn list_files(path: String) -> Result<Vec<String>, String> {
    let out = run_git(&path, &["-c", "core.quotePath=false", "ls-files"])?;
    Ok(out
        .lines()
        .filter(|l| !l.is_empty())
        .map(|s| s.to_string())
        .collect())
}

/// Read a working-tree file's text content, guarding against binary / huge files.
#[tauri::command]
pub fn read_file(path: String, file: String) -> Result<FileContent, String> {
    const LIMIT: u64 = 2_000_000;
    let full = Path::new(&path).join(&file);
    let size = std::fs::metadata(&full).map_err(|e| e.to_string())?.len();
    if size > LIMIT {
        return Ok(FileContent { text: String::new(), binary: false, too_large: true, size });
    }
    let bytes = std::fs::read(&full).map_err(|e| e.to_string())?;
    if bytes.contains(&0u8) {
        return Ok(FileContent { text: String::new(), binary: true, too_large: false, size });
    }
    Ok(FileContent {
        text: String::from_utf8_lossy(&bytes).into_owned(),
        binary: false,
        too_large: false,
        size,
    })
}
