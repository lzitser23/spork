//! Thin wrappers around the GitHub CLI (`gh`) for pull-request review.
//!
//! `gh` brings its own sign-in (`gh auth login`) and repo detection (from the
//! git remotes), so Spork never stores tokens or talks to the GitHub API
//! itself. List output is gh's JSON, passed to the frontend verbatim — the
//! TypeScript side owns those types.

use crate::git::{command_output, new_command, CommandError, COMMAND_TIMEOUT};

/// Run `gh <args>` inside `repo` and return stdout, or stderr as the error.
///
/// A missing binary maps to the sentinel `gh-not-installed`, which the
/// frontend turns into setup instructions instead of a raw OS error.
fn run_gh(repo: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = new_command("gh");
    cmd.current_dir(repo).args(args);
    let output = command_output(cmd, COMMAND_TIMEOUT).map_err(|e| match e {
        CommandError::Launch(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                "gh-not-installed".to_string()
            } else {
                format!("failed to launch gh: {e}")
            }
        }
        CommandError::OutputReader => "failed to capture gh output".to_string(),
        CommandError::TimedOut => {
            format!("gh {} timed out after {}s", args.join(" "), COMMAND_TIMEOUT.as_secs())
        }
    })?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if err.is_empty() {
            format!("gh {} failed", args.join(" "))
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Open pull requests on the repo's GitHub remote, as gh's JSON (verbatim).
#[tauri::command]
pub fn gh_pr_list(path: String) -> Result<String, String> {
    run_gh(
        &path,
        &[
            "pr",
            "list",
            "--limit",
            "50",
            "--json",
            "number,title,body,author,headRefName,baseRefName,updatedAt,isDraft,reviewDecision,additions,deletions,url",
        ],
    )
}

/// The full unified diff of a pull request.
#[tauri::command]
pub fn gh_pr_diff(path: String, number: u64) -> Result<String, String> {
    run_gh(&path, &["pr", "diff", &number.to_string()])
}

/// Check out the PR's branch locally (gh creates a tracking branch, fetching
/// from the contributor's fork when needed).
#[tauri::command]
pub fn gh_pr_checkout(path: String, number: u64) -> Result<String, String> {
    run_gh(&path, &["pr", "checkout", &number.to_string()])
}

/// Submit a review. GitHub requires a body for `comment` and
/// `request-changes`; `approve` takes an optional one.
#[tauri::command]
pub fn gh_pr_review(
    path: String,
    number: u64,
    verdict: String,
    body: String,
) -> Result<String, String> {
    let flag = match verdict.as_str() {
        "approve" => "--approve",
        "comment" => "--comment",
        "request-changes" => "--request-changes",
        _ => return Err(format!("unknown review verdict: {verdict}")),
    };
    let n = number.to_string();
    let mut args = vec!["pr", "review", &n, flag];
    if !body.trim().is_empty() {
        args.push("--body");
        args.push(&body);
    }
    run_gh(&path, &args)
}

/// Merge the PR with an explicit strategy, so gh never falls back to an
/// interactive prompt.
#[tauri::command]
pub fn gh_pr_merge(path: String, number: u64, strategy: String) -> Result<String, String> {
    let flag = match strategy.as_str() {
        "merge" => "--merge",
        "squash" => "--squash",
        "rebase" => "--rebase",
        _ => return Err(format!("unknown merge strategy: {strategy}")),
    };
    run_gh(&path, &["pr", "merge", &number.to_string(), flag])
}
