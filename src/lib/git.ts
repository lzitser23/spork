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
