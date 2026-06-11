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
export const workingDiff = (path: string, file: string) =>
  invoke<string>("working_diff", { path, file });
export const gitCheckout = (path: string, name: string) =>
  invoke<string>("git_checkout", { path, name });
export const gitStage = (path: string, file: string) =>
  invoke<string>("git_stage", { path, file });
export const gitUnstage = (path: string, file: string) =>
  invoke<string>("git_unstage", { path, file });
export const gitStageAll = (path: string) => invoke<string>("git_stage_all", { path });
export const gitUnstageAll = (path: string) => invoke<string>("git_unstage_all", { path });
export const gitCommit = (path: string, message: string) =>
  invoke<string>("git_commit", { path, message });
export const gitCreateBranch = (path: string, name: string) =>
  invoke<string>("git_create_branch", { path, name });
export const gitDeleteBranch = (path: string, name: string, force = false) =>
  invoke<string>("git_delete_branch", { path, name, force });
export const gitRemoteBranches = (path: string) =>
  invoke<string[]>("git_remote_branches", { path });
export const gitRemoteTips = (path: string) =>
  invoke<string>("git_remote_tips", { path });
export const gitCommitAll = (path: string, message: string) =>
  invoke<string>("git_commit_all", { path, message });
export const addToGitignore = (path: string, file: string) =>
  invoke<string>("add_to_gitignore", { path, file });
export const gitStashPop = (path: string, reff: string) =>
  invoke<string>("git_stash_pop", { path, reff });
export const gitStashApply = (path: string, reff: string) =>
  invoke<string>("git_stash_apply", { path, reff });
export const gitStashDrop = (path: string, reff: string) =>
  invoke<string>("git_stash_drop", { path, reff });
export const gitCreateTag = (path: string, name: string) =>
  invoke<string>("git_create_tag", { path, name });
export const gitDeleteTag = (path: string, name: string) =>
  invoke<string>("git_delete_tag", { path, name });
export const gitRemoveRemote = (path: string, name: string) =>
  invoke<string>("git_remove_remote", { path, name });
export const gitSubmodules = (path: string) =>
  invoke<string[]>("git_submodules", { path });
export const gitSubmoduleUpdate = (path: string) =>
  invoke<string>("git_submodule_update", { path });
export const gitFetch = (path: string) => invoke<string>("git_fetch", { path });
export const gitPull = (path: string) => invoke<string>("git_pull", { path });
export const gitPush = (path: string) => invoke<string>("git_push", { path });
export const gitStash = (path: string) => invoke<string>("git_stash", { path });
export const gitClone = (url: string, parentDir: string) =>
  invoke<string>("git_clone", { url, parentDir });
export const gitAddRemote = (path: string, name: string, url: string) =>
  invoke<string>("git_add_remote", { path, name, url });
export const startRepoWatch = (path: string) => invoke<void>("start_repo_watch", { path });
export const stopRepoWatch = () => invoke<void>("stop_repo_watch");

export interface RepoChangedPayload {
  path: string;
}

export interface FileContent {
  text: string;
  binary: boolean;
  too_large: boolean;
  size: number;
}
export const listFiles = (path: string) => invoke<string[]>("list_files", { path });
export const readFile = (path: string, file: string) =>
  invoke<FileContent>("read_file", { path, file });

export interface ImageContent {
  data: string;
  mime: string;
  too_large: boolean;
  size: number;
}
export const readImage = (path: string, file: string) =>
  invoke<ImageContent>("read_image", { path, file });
