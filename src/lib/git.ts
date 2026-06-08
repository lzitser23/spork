import { invoke } from "@tauri-apps/api/core";

export interface RepoInfo {
  path: string;
  name: string;
  branch: string;
  head: string;
}

export interface Commit {
  hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  /** Author date, Unix seconds. */
  timestamp: number;
  subject: string;
}

export interface StatusEntry {
  /** Staged (index) status char. */
  x: string;
  /** Unstaged (work-tree) status char. */
  y: string;
  path: string;
}

export interface Branch {
  name: string;
  is_current: boolean;
  upstream: string | null;
}

export const openRepo = (path: string) => invoke<RepoInfo>("open_repo", { path });

export const gitLog = (path: string, limit?: number) =>
  invoke<Commit[]>("git_log", { path, limit });

export const gitStatus = (path: string) => invoke<StatusEntry[]>("git_status", { path });

export const gitBranches = (path: string) => invoke<Branch[]>("git_branches", { path });
