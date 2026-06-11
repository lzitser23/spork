//! Pure parsers for `git` porcelain/format output.
//!
//! Every function here is `&str -> data` with no I/O — the porcelain knowledge
//! lives in one place and is testable with captured fixtures instead of a live
//! repo. The commands in [`crate::git`] shell out, then hand the output here.

use serde::Serialize;
use std::collections::HashMap;

/// ASCII unit separator — used between fields in our custom format strings
/// because it can't appear in branch names, hashes, emails, or subjects.
pub const US: char = '\u{1f}';
/// ASCII record separator — used between records (e.g. commits).
pub const RS: char = '\u{1e}';

/// A ref pointing at a commit (for the colored pills next to commits).
#[derive(Serialize, Debug, PartialEq)]
pub struct RefBadge {
    pub name: String,
    /// "head" (current branch), "branch", "remote", or "tag".
    pub kind: String,
}

#[derive(Serialize, Debug, PartialEq)]
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

#[derive(Serialize, Debug, PartialEq)]
pub struct StatusEntry {
    pub x: String,
    pub y: String,
    pub path: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Branch {
    pub name: String,
    pub is_current: bool,
    pub upstream: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Remote {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Stash {
    pub index: usize,
    pub reff: String,
    pub message: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Person {
    pub name: String,
    pub email: String,
    pub timestamp: i64,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct CommitDetails {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    pub author: Person,
    pub committer: Person,
    pub subject: String,
    pub body: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct FileChange {
    /// Single-letter status: A, M, D, R, C, T.
    pub status: String,
    pub path: String,
    pub additions: i64,
    pub deletions: i64,
    pub binary: bool,
}

/// Parse `git log` output produced with the
/// `%H{US}%h{US}%an{US}%ae{US}%at{US}%P{US}%D{US}%s{RS}` format.
/// Records with fewer than 8 fields are skipped.
pub fn parse_log(out: &str) -> Vec<Commit> {
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
    commits
}

/// Turn a `%D` decoration string ("HEAD -> main, origin/main, tag: v1") into badges.
pub fn parse_refs(decoration: &str) -> Vec<RefBadge> {
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

/// Parse `git status --porcelain` output.
pub fn parse_status(out: &str) -> Vec<StatusEntry> {
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
    entries
}

/// Parse `git for-each-ref` over `refs/heads` with the
/// `%(HEAD){US}%(refname:short){US}%(upstream:short)` format.
pub fn parse_branches(out: &str) -> Vec<Branch> {
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
    branches
}

/// Parse `git remote -v` output, deduped to one fetch URL per remote, sorted by name.
pub fn parse_remotes(out: &str) -> Vec<Remote> {
    let mut seen: HashMap<String, String> = HashMap::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[2] == "(fetch)" {
            seen.entry(parts[0].to_string()).or_insert_with(|| parts[1].to_string());
        }
    }
    let mut v: Vec<Remote> = seen.into_iter().map(|(name, url)| Remote { name, url }).collect();
    v.sort_by(|a, b| a.name.cmp(&b.name));
    v
}

/// Parse `git tag --sort=-creatordate` output, capped at 200 names.
pub fn parse_tags(out: &str) -> Vec<String> {
    out.lines()
        .filter(|l| !l.trim().is_empty())
        .take(200)
        .map(|s| s.to_string())
        .collect()
}

/// Parse `git stash list` output with the `%gd{US}%gs` format.
pub fn parse_stashes(out: &str) -> Vec<Stash> {
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
    v
}

/// Parse `git show -s` output with the 11-field
/// `%H{US}%h{US}%P{US}%an{US}%ae{US}%at{US}%cn{US}%ce{US}%ct{US}%s{US}%b` format.
pub fn parse_commit_details(out: &str) -> Result<CommitDetails, String> {
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

/// Combine `git diff-tree --numstat` and `--name-status` outputs for one commit
/// into per-file changes. Renames report the destination path; binary files
/// show `-` in numstat and get zero counts with `binary: true`.
pub fn parse_commit_files(numstat: &str, name_status: &str) -> Vec<FileChange> {
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
    out
}

/// Parse `git submodule status` output into submodule paths (second column).
pub fn parse_submodules(out: &str) -> Vec<String> {
    out.lines()
        .filter_map(|l| l.split_whitespace().nth(1).map(String::from))
        .collect()
}

/// Parse `git for-each-ref --format=%(refname:short) refs/remotes` output,
/// excluding the `*/HEAD` alias.
pub fn parse_remote_branches(out: &str) -> Vec<String> {
    out.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.ends_with("/HEAD"))
        .map(|s| s.to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn log_record(fields: &[&str]) -> String {
        format!("{}{RS}", fields.join(&US.to_string()))
    }

    #[test]
    fn parse_log_reads_a_full_record() {
        let out = log_record(&[
            "a1b2c3d4", "a1b2c3d", "Ada", "ada@example.com", "1700000000",
            "p1 p2", "HEAD -> main, tag: v1", "fix: the thing",
        ]);
        let commits = parse_log(&out);
        assert_eq!(commits.len(), 1);
        let c = &commits[0];
        assert_eq!(c.hash, "a1b2c3d4");
        assert_eq!(c.author_name, "Ada");
        assert_eq!(c.timestamp, 1_700_000_000);
        assert_eq!(c.parents, vec!["p1", "p2"]);
        assert_eq!(c.subject, "fix: the thing");
        assert_eq!(c.refs.len(), 2);
    }

    #[test]
    fn parse_log_skips_records_with_missing_fields() {
        // A truncated record (e.g. interleaved output) is dropped, not mangled.
        let good = log_record(&[
            "h", "h", "a", "a@e", "1", "", "", "subject",
        ]);
        let bad = format!("only{US}three{US}fields{RS}");
        let commits = parse_log(&format!("{bad}{good}"));
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].subject, "subject");
    }

    #[test]
    fn parse_log_keeps_subjects_containing_separator_lookalikes() {
        let out = log_record(&[
            "h", "h", "a", "a@e", "0", "", "", "subject with, commas and -> arrows",
        ]);
        assert_eq!(parse_log(&out)[0].subject, "subject with, commas and -> arrows");
    }

    #[test]
    fn parse_refs_classifies_each_kind() {
        let refs = parse_refs("HEAD -> main, origin/main, tag: v1.0, dev");
        assert_eq!(
            refs,
            vec![
                RefBadge { name: "main".into(), kind: "head".into() },
                RefBadge { name: "origin/main".into(), kind: "remote".into() },
                RefBadge { name: "v1.0".into(), kind: "tag".into() },
                RefBadge { name: "dev".into(), kind: "branch".into() },
            ]
        );
    }

    #[test]
    fn parse_refs_handles_detached_head_and_empty() {
        assert_eq!(parse_refs(""), vec![]);
        assert_eq!(
            parse_refs("HEAD"),
            vec![RefBadge { name: "HEAD".into(), kind: "head".into() }]
        );
    }

    #[test]
    fn parse_status_reads_porcelain_pairs() {
        let out = " M src/app.ts\nM  staged.ts\n?? new file.txt\n";
        let entries = parse_status(out);
        assert_eq!(
            entries,
            vec![
                StatusEntry { x: " ".into(), y: "M".into(), path: "src/app.ts".into() },
                StatusEntry { x: "M".into(), y: " ".into(), path: "staged.ts".into() },
                StatusEntry { x: "?".into(), y: "?".into(), path: "new file.txt".into() },
            ]
        );
    }

    #[test]
    fn parse_status_skips_short_lines() {
        assert_eq!(parse_status("M x\n\n"), vec![]);
    }

    #[test]
    fn parse_branches_marks_current_and_upstream() {
        let out = format!(
            "*{US}main{US}origin/main\n{US}dev{US}\n",
        );
        let branches = parse_branches(&out);
        assert_eq!(
            branches,
            vec![
                Branch { name: "main".into(), is_current: true, upstream: Some("origin/main".into()) },
                Branch { name: "dev".into(), is_current: false, upstream: None },
            ]
        );
    }

    #[test]
    fn parse_remotes_dedupes_to_fetch_url_and_sorts() {
        let out = "upstream\thttps://b (fetch)\nupstream\thttps://b (push)\norigin\thttps://a (fetch)\norigin\thttps://a (push)\n";
        assert_eq!(
            parse_remotes(out),
            vec![
                Remote { name: "origin".into(), url: "https://a".into() },
                Remote { name: "upstream".into(), url: "https://b".into() },
            ]
        );
    }

    #[test]
    fn parse_tags_drops_blanks_and_caps_at_200() {
        let many: String = (0..250).map(|i| format!("v{i}\n")).collect();
        assert_eq!(parse_tags(&many).len(), 200);
        assert_eq!(parse_tags("v1\n\n v2 \n"), vec!["v1", " v2 "]);
    }

    #[test]
    fn parse_stashes_indexes_in_order() {
        let out = format!("stash@{{0}}{US}WIP on main\nstash@{{1}}{US}older\n");
        let stashes = parse_stashes(&out);
        assert_eq!(stashes.len(), 2);
        assert_eq!(stashes[0].reff, "stash@{0}");
        assert_eq!(stashes[0].index, 0);
        assert_eq!(stashes[1].message, "older");
    }

    #[test]
    fn parse_commit_details_reads_all_fields() {
        let out = [
            "full", "short", "p1 p2", "Ada", "ada@e", "100", "Bob", "bob@e", "200",
            "subject line", "body line 1\nbody line 2\n\n",
        ]
        .join(&US.to_string());
        let d = parse_commit_details(&out).unwrap();
        assert_eq!(d.parents, vec!["p1", "p2"]);
        assert_eq!(d.author.name, "Ada");
        assert_eq!(d.committer.timestamp, 200);
        assert_eq!(d.body, "body line 1\nbody line 2");
    }

    #[test]
    fn parse_commit_details_rejects_short_output() {
        assert!(parse_commit_details("garbage").is_err());
    }

    #[test]
    fn parse_commit_files_joins_counts_with_statuses() {
        let numstat = "10\t2\tsrc/a.rs\n-\t-\tlogo.png\n";
        let name_status = "M\tsrc/a.rs\nA\tlogo.png\n";
        let files = parse_commit_files(numstat, name_status);
        assert_eq!(
            files,
            vec![
                FileChange { status: "M".into(), path: "src/a.rs".into(), additions: 10, deletions: 2, binary: false },
                FileChange { status: "A".into(), path: "logo.png".into(), additions: 0, deletions: 0, binary: true },
            ]
        );
    }

    #[test]
    fn parse_commit_files_uses_rename_destination() {
        // A rename has three numstat/name-status columns; the last is the new path.
        let numstat = "5\t1\told.rs\tnew.rs\n";
        let name_status = "R95\told.rs\tnew.rs\n";
        let files = parse_commit_files(numstat, name_status);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].status, "R");
        assert_eq!(files[0].path, "new.rs");
        assert_eq!(files[0].additions, 5);
    }

    #[test]
    fn parse_submodules_takes_second_column() {
        let out = " a1b2c3 libs/dep (v1.0)\n+d4e5f6 vendor/thing (heads/main)\n";
        assert_eq!(parse_submodules(out), vec!["libs/dep", "vendor/thing"]);
    }

    #[test]
    fn parse_remote_branches_excludes_head_alias() {
        let out = "origin/HEAD\norigin/main\norigin/dev\n";
        assert_eq!(parse_remote_branches(out), vec!["origin/main", "origin/dev"]);
    }
}
