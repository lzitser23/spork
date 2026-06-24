import { createContext, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type {
  Branch,
  BranchMergeStrategy,
  Commit,
  CommitDetails,
  FileChange,
  FileContent,
  ImageContent,
  MergeStrategy,
  PullRequest,
  Remote,
  RepoChangedPayload,
  RepoInfo,
  ResetMode,
  ReviewVerdict,
  Stash,
  StatusEntry,
} from "@/lib/git";

/**
 * Everything the UI can ask of a Git repository. The one seam between React
 * and the backend: prod uses the Tauri adapter below; tests provide an
 * in-memory adapter through {@link GitClientProvider}.
 */
export interface GitClient {
  openRepo(path: string): Promise<RepoInfo>;
  log(path: string, limit?: number): Promise<Commit[]>;
  status(path: string): Promise<StatusEntry[]>;
  branches(path: string): Promise<Branch[]>;
  remoteBranches(path: string): Promise<string[]>;
  remotes(path: string): Promise<Remote[]>;
  tags(path: string): Promise<string[]>;
  stashes(path: string): Promise<Stash[]>;
  submodules(path: string): Promise<string[]>;
  commitDetails(path: string, hash: string): Promise<CommitDetails>;
  commitFiles(path: string, hash: string): Promise<FileChange[]>;
  fileDiff(path: string, hash: string, file: string): Promise<string>;
  workingDiff(path: string, file: string): Promise<string>;
  listFiles(path: string): Promise<string[]>;
  readFile(path: string, file: string): Promise<FileContent>;
  readImage(path: string, file: string): Promise<ImageContent>;
  /** An image blob at a specific revision (`git show <rev>:<file>`). */
  readImageAt(path: string, rev: string, file: string): Promise<ImageContent>;
  /** Snapshot of remote-tracking ref tips; compared across fetches. */
  remoteTips(path: string): Promise<string>;

  checkout(path: string, name: string): Promise<string>;
  /** Create a branch (and switch to it) at `startPoint`, or at HEAD if omitted. */
  createBranch(path: string, name: string, startPoint?: string): Promise<string>;
  deleteBranch(path: string, name: string, force?: boolean): Promise<string>;
  /** Tag `commit` (a hash / ref), or HEAD if omitted. */
  createTag(path: string, name: string, commit?: string): Promise<string>;
  deleteTag(path: string, name: string): Promise<string>;
  /** Revert a commit, creating an inverse commit (`git revert --no-edit`). */
  revert(path: string, hash: string): Promise<string>;
  /** Cherry-pick a commit onto the current branch. */
  cherryPick(path: string, hash: string): Promise<string>;
  /** Move the current branch to `hash` (soft / mixed / hard). */
  reset(path: string, hash: string, mode: ResetMode): Promise<string>;
  /** Merge `source` into the current branch with an explicit strategy. */
  merge(path: string, source: string, strategy: BranchMergeStrategy): Promise<string>;
  addRemote(path: string, name: string, url: string): Promise<string>;
  removeRemote(path: string, name: string): Promise<string>;
  submoduleUpdate(path: string): Promise<string>;
  stage(path: string, file: string): Promise<string>;
  unstage(path: string, file: string): Promise<string>;
  stageAll(path: string): Promise<string>;
  unstageAll(path: string): Promise<string>;
  commit(path: string, message: string): Promise<string>;
  /** Stage everything, then commit. */
  commitAll(path: string, message: string): Promise<string>;
  addToGitignore(path: string, file: string): Promise<string>;
  stashSave(path: string): Promise<string>;
  stashPop(path: string, reff: string): Promise<string>;
  stashApply(path: string, reff: string): Promise<string>;
  stashDrop(path: string, reff: string): Promise<string>;
  fetch(path: string): Promise<string>;
  pull(path: string): Promise<string>;
  push(path: string): Promise<string>;
  clone(url: string, parentDir: string): Promise<string>;

  /**
   * Pull-request review, backed by the GitHub CLI (`gh`) — it brings its own
   * sign-in and repo detection. Calls reject with the sentinel
   * `gh-not-installed` when the CLI is missing.
   */
  prList(path: string): Promise<PullRequest[]>;
  prDiff(path: string, number: number): Promise<string>;
  prCheckout(path: string, number: number): Promise<string>;
  prReview(
    path: string,
    number: number,
    verdict: ReviewVerdict,
    body: string,
  ): Promise<string>;
  prMerge(path: string, number: number, strategy: MergeStrategy): Promise<string>;

  /**
   * Watch the repo for external changes. `onChange` fires on every change the
   * backend reports for `path`. Resolves to a stop function.
   */
  watchRepo(path: string, onChange: () => void): Promise<() => void>;
}

/** The production adapter: every call crosses the Tauri seam via `invoke`. */
export const tauriGitClient: GitClient = {
  openRepo: (path) => invoke("open_repo", { path }),
  log: (path, limit) => invoke("git_log", { path, limit }),
  status: (path) => invoke("git_status", { path }),
  branches: (path) => invoke("git_branches", { path }),
  remoteBranches: (path) => invoke("git_remote_branches", { path }),
  remotes: (path) => invoke("git_remotes", { path }),
  tags: (path) => invoke("git_tags", { path }),
  stashes: (path) => invoke("git_stashes", { path }),
  submodules: (path) => invoke("git_submodules", { path }),
  commitDetails: (path, hash) => invoke("commit_details", { path, hash }),
  commitFiles: (path, hash) => invoke("commit_files", { path, hash }),
  fileDiff: (path, hash, file) => invoke("file_diff", { path, hash, file }),
  workingDiff: (path, file) => invoke("working_diff", { path, file }),
  listFiles: (path) => invoke("list_files", { path }),
  readFile: (path, file) => invoke("read_file", { path, file }),
  readImage: (path, file) => invoke("read_image", { path, file }),
  readImageAt: (path, rev, file) => invoke("read_image_at", { path, rev, file }),
  remoteTips: (path) => invoke("git_remote_tips", { path }),

  checkout: (path, name) => invoke("git_checkout", { path, name }),
  createBranch: (path, name, startPoint) =>
    invoke("git_create_branch", { path, name, startPoint }),
  deleteBranch: (path, name, force = false) =>
    invoke("git_delete_branch", { path, name, force }),
  createTag: (path, name, commit) => invoke("git_create_tag", { path, name, commit }),
  deleteTag: (path, name) => invoke("git_delete_tag", { path, name }),
  revert: (path, hash) => invoke("git_revert", { path, hash }),
  cherryPick: (path, hash) => invoke("git_cherry_pick", { path, hash }),
  reset: (path, hash, mode) => invoke("git_reset", { path, hash, mode }),
  merge: (path, source, strategy) => invoke("git_merge", { path, source, strategy }),
  addRemote: (path, name, url) => invoke("git_add_remote", { path, name, url }),
  removeRemote: (path, name) => invoke("git_remove_remote", { path, name }),
  submoduleUpdate: (path) => invoke("git_submodule_update", { path }),
  stage: (path, file) => invoke("git_stage", { path, file }),
  unstage: (path, file) => invoke("git_unstage", { path, file }),
  stageAll: (path) => invoke("git_stage_all", { path }),
  unstageAll: (path) => invoke("git_unstage_all", { path }),
  commit: (path, message) => invoke("git_commit", { path, message }),
  commitAll: (path, message) => invoke("git_commit_all", { path, message }),
  addToGitignore: (path, file) => invoke("add_to_gitignore", { path, file }),
  stashSave: (path) => invoke("git_stash", { path }),
  stashPop: (path, reff) => invoke("git_stash_pop", { path, reff }),
  stashApply: (path, reff) => invoke("git_stash_apply", { path, reff }),
  stashDrop: (path, reff) => invoke("git_stash_drop", { path, reff }),
  fetch: (path) => invoke("git_fetch", { path }),
  pull: (path) => invoke("git_pull", { path }),
  push: (path) => invoke("git_push", { path }),
  clone: (url, parentDir) => invoke("git_clone", { url, parentDir }),

  prList: async (path) =>
    JSON.parse(await invoke<string>("gh_pr_list", { path })) as PullRequest[],
  prDiff: (path, number) => invoke("gh_pr_diff", { path, number }),
  prCheckout: (path, number) => invoke("gh_pr_checkout", { path, number }),
  prReview: (path, number, verdict, body) =>
    invoke("gh_pr_review", { path, number, verdict, body }),
  prMerge: (path, number, strategy) =>
    invoke("gh_pr_merge", { path, number, strategy }),

  async watchRepo(path, onChange) {
    await invoke<void>("start_repo_watch", { path });
    const unlisten = await listen<RepoChangedPayload>("repo_changed", (event) => {
      if (event.payload.path === path) onChange();
    });
    return () => {
      unlisten();
      void invoke<void>("stop_repo_watch").catch(() => {});
    };
  },
};

const GitClientContext = createContext<GitClient>(tauriGitClient);

/** Override the Git client (tests supply an in-memory adapter). */
export const GitClientProvider = GitClientContext.Provider;

/** The Git client for the current tree — defaults to the Tauri adapter. */
export function useGit(): GitClient {
  return useContext(GitClientContext);
}
