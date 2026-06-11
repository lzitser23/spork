/**
 * Data shapes shared across the Git client seam. These mirror the serde
 * structs in `src-tauri/src/git/parse.rs`; the calls that produce them live
 * behind the `GitClient` interface in `@/lib/gitClient`.
 */

export interface RepoInfo {
  path: string;
  name: string;
  branch: string;
  head: string;
}

export type RefKind = "head" | "branch" | "remote" | "tag";
export interface RefBadge {
  name: string;
  kind: RefKind;
}

export interface Commit {
  hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  subject: string;
  /** Parent commit hashes (full). Empty for the root; >1 for a merge. */
  parents: string[];
  refs: RefBadge[];
}

export interface StatusEntry {
  x: string;
  y: string;
  path: string;
}

export interface Branch {
  name: string;
  is_current: boolean;
  upstream: string | null;
}

export interface Remote {
  name: string;
  url: string;
}

export interface Stash {
  index: number;
  reff: string;
  message: string;
}

export interface Person {
  name: string;
  email: string;
  timestamp: number;
}

export interface CommitDetails {
  hash: string;
  short_hash: string;
  parents: string[];
  author: Person;
  committer: Person;
  subject: string;
  body: string;
}

export interface FileChange {
  status: string;
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
}

/**
 * A pull request as reported by the GitHub CLI (`gh pr list --json …`).
 * Field names are gh's (camelCase), since the JSON passes through verbatim.
 */
export interface PullRequest {
  number: number;
  title: string;
  body: string;
  author: { login: string };
  headRefName: string;
  baseRefName: string;
  updatedAt: string;
  isDraft: boolean;
  /** "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "" */
  reviewDecision: string;
  additions: number;
  deletions: number;
  url: string;
}

export type ReviewVerdict = "approve" | "comment" | "request-changes";
export type MergeStrategy = "merge" | "squash" | "rebase";

export interface RepoChangedPayload {
  path: string;
}

export interface FileContent {
  text: string;
  binary: boolean;
  too_large: boolean;
  size: number;
}

export interface ImageContent {
  data: string;
  mime: string;
  too_large: boolean;
  size: number;
}
