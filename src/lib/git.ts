import { invoke } from "@tauri-apps/api/core";

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

export const openRepo = (path: string) => invoke<RepoInfo>("open_repo", { path });
export const gitLog = (path: string, limit?: number) =>
  invoke<Commit[]>("git_log", { path, limit });
export const gitStatus = (path: string) => invoke<StatusEntry[]>("git_status", { path });
export const gitBranches = (path: string) => invoke<Branch[]>("git_branches", { path });
export const gitRemotes = (path: string) => invoke<Remote[]>("git_remotes", { path });
export const gitTags = (path: string) => invoke<string[]>("git_tags", { path });
export const gitStashes = (path: string) => invoke<Stash[]>("git_stashes", { path });
export const commitDetails = (path: string, hash: string) =>
  invoke<CommitDetails>("commit_details", { path, hash });
export const commitFiles = (path: string, hash: string) =>
  invoke<FileChange[]>("commit_files", { path, hash });
export const fileDiff = (path: string, hash: string, file: string) =>
  invoke<string>("file_diff", { path, hash, file });
export const gitFetch = (path: string) => invoke<string>("git_fetch", { path });
export const gitPull = (path: string) => invoke<string>("git_pull", { path });
export const gitPush = (path: string) => invoke<string>("git_push", { path });
export const gitStash = (path: string) => invoke<string>("git_stash", { path });
export const gitClone = (url: string, parentDir: string) =>
  invoke<string>("git_clone", { url, parentDir });
export const gitAddRemote = (path: string, name: string, url: string) =>
  invoke<string>("git_add_remote", { path, name, url });

export interface FileContent {
  text: string;
  binary: boolean;
  too_large: boolean;
  size: number;
}
export const listFiles = (path: string) => invoke<string[]>("list_files", { path });
export const readFile = (path: string, file: string) =>
  invoke<FileContent>("read_file", { path, file });
