import type {
  Branch,
  BranchMergeStrategy,
  Commit,
  CommitDetails,
  FileChange,
  FileContent,
  ImageContent,
  PullRequest,
  Remote,
  RepoInfo,
  ResetMode,
  ReviewVerdict,
  Stash,
  StatusEntry,
} from "@/lib/git";
import type { GitClient } from "@/lib/gitClient";

/** Everything the fake serves; tests mutate it between calls. */
export interface FakeRepoState {
  info: RepoInfo;
  commits: Commit[];
  status: StatusEntry[];
  branches: Branch[];
  remoteBranches: string[];
  remotes: Remote[];
  tags: string[];
  stashes: Stash[];
  submodules: string[];
  files: string[];
  /** Diff text keyed by `${hash}:${file}` (commits) or `working:${file}`. */
  diffs: Record<string, string>;
  fileContents: Record<string, FileContent>;
  remoteTips: string;
  pullRequests: PullRequest[];
  /** Full PR diff text keyed by PR number. */
  prDiffs: Record<number, string>;
  /** Per-method error message — when set, that method rejects with it. */
  errors: Partial<Record<keyof GitClient, string>>;
}

export interface RecordedCall {
  method: keyof GitClient;
  args: unknown[];
}

export function makeCommit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: "a1b2c3d4e5",
    short_hash: "a1b2c3d",
    author_name: "Test Author",
    author_email: "test@example.com",
    timestamp: 1_700_000_000,
    subject: "initial commit",
    parents: [],
    refs: [],
    ...overrides,
  };
}

export function makePullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    title: "Example change",
    body: "",
    author: { login: "contributor" },
    headRefName: "feature/example",
    baseRefName: "main",
    updatedAt: "2026-06-01T12:00:00Z",
    isDraft: false,
    reviewDecision: "REVIEW_REQUIRED",
    additions: 1,
    deletions: 0,
    url: "https://github.com/example/repo/pull/1",
    ...overrides,
  };
}

export function makeState(overrides: Partial<FakeRepoState> = {}): FakeRepoState {
  return {
    info: { path: "/repo", name: "repo", branch: "main", head: "a1b2c3d" },
    commits: [makeCommit()],
    status: [],
    branches: [{ name: "main", is_current: true, upstream: "origin/main" }],
    remoteBranches: ["origin/main"],
    remotes: [{ name: "origin", url: "https://github.com/example/repo.git" }],
    tags: [],
    stashes: [],
    submodules: [],
    files: [],
    diffs: {},
    fileContents: {},
    remoteTips: "refs/remotes/origin/main a1b2c3d4e5",
    pullRequests: [],
    prDiffs: {},
    errors: {},
    ...overrides,
  };
}

/**
 * In-memory {@link GitClient} adapter. Reads serve from {@link FakeRepoState};
 * mutations apply a simplified model of git's behavior (enough for the UI's
 * observable state transitions). Every call is recorded for assertions, and
 * `fireRepoChange` simulates the file watcher reporting an external change.
 */
export function createFakeGit(overrides: Partial<FakeRepoState> = {}) {
  const state = makeState(overrides);
  const calls: RecordedCall[] = [];
  const watchers: Array<() => void> = [];
  let commitCounter = 0;

  const call =
    <A extends unknown[], R>(method: keyof GitClient, fn: (...args: A) => R) =>
    (...args: A): Promise<Awaited<R>> => {
      calls.push({ method, args });
      const err = state.errors[method];
      if (err) return Promise.reject(err);
      return Promise.resolve(fn(...args)) as Promise<Awaited<R>>;
    };

  const addCommit = (message: string) => {
    commitCounter += 1;
    const hash = `commit${commitCounter}`.padEnd(10, "0");
    state.commits = [
      makeCommit({ hash, short_hash: hash.slice(0, 7), subject: message }),
      ...state.commits,
    ];
    state.info = { ...state.info, head: hash.slice(0, 7) };
  };

  const client: GitClient = {
    openRepo: call("openRepo", () => state.info),
    log: call("log", () => state.commits),
    status: call("status", () => state.status),
    branches: call("branches", () => state.branches),
    remoteBranches: call("remoteBranches", () => state.remoteBranches),
    remotes: call("remotes", () => state.remotes),
    tags: call("tags", () => state.tags),
    stashes: call("stashes", () => state.stashes),
    submodules: call("submodules", () => state.submodules),
    commitDetails: call("commitDetails", (_path: string, hash: string): CommitDetails => {
      const c = state.commits.find((x) => x.hash === hash);
      if (!c) throw new Error(`no such commit: ${hash}`);
      return {
        hash: c.hash,
        short_hash: c.short_hash,
        parents: c.parents,
        author: { name: c.author_name, email: c.author_email, timestamp: c.timestamp },
        committer: { name: c.author_name, email: c.author_email, timestamp: c.timestamp },
        subject: c.subject,
        body: "",
      };
    }),
    commitFiles: call("commitFiles", (): FileChange[] => []),
    fileDiff: call(
      "fileDiff",
      (_path: string, hash: string, file: string) => state.diffs[`${hash}:${file}`] ?? "",
    ),
    workingDiff: call(
      "workingDiff",
      (_path: string, file: string) => state.diffs[`working:${file}`] ?? "",
    ),
    listFiles: call("listFiles", () => state.files),
    readFile: call(
      "readFile",
      (_path: string, file: string): FileContent =>
        state.fileContents[file] ?? { text: "", binary: false, too_large: false, size: 0 },
    ),
    readImage: call(
      "readImage",
      (): ImageContent => ({ data: "", mime: "image/png", too_large: false, size: 0 }),
    ),
    readImageAt: call(
      "readImageAt",
      (): ImageContent => ({ data: "", mime: "image/png", too_large: false, size: 0 }),
    ),
    remoteTips: call("remoteTips", () => state.remoteTips),

    checkout: call("checkout", (_path: string, name: string) => {
      state.info = { ...state.info, branch: name };
      state.branches = state.branches.map((b) => ({ ...b, is_current: b.name === name }));
      return "ok";
    }),
    createBranch: call("createBranch", (_path: string, name: string) => {
      state.branches = [
        ...state.branches.map((b) => ({ ...b, is_current: false })),
        { name, is_current: true, upstream: null },
      ];
      state.info = { ...state.info, branch: name };
      return "ok";
    }),
    deleteBranch: call("deleteBranch", (_path: string, name: string) => {
      state.branches = state.branches.filter((b) => b.name !== name);
      return "ok";
    }),
    revert: call("revert", (_path: string, hash: string) => {
      const c = state.commits.find((x) => x.hash === hash);
      addCommit(`Revert "${c?.subject ?? hash}"`);
      return "ok";
    }),
    cherryPick: call("cherryPick", (_path: string, hash: string) => {
      const c = state.commits.find((x) => x.hash === hash);
      addCommit(c?.subject ?? `cherry-pick ${hash}`);
      return "ok";
    }),
    reset: call("reset", (_path: string, hash: string, mode: ResetMode) => {
      const i = state.commits.findIndex((x) => x.hash === hash);
      if (i >= 0) {
        state.commits = state.commits.slice(i);
        state.info = { ...state.info, head: state.commits[0].short_hash };
      }
      if (mode === "hard") state.status = [];
      return "ok";
    }),
    merge: call("merge", (_path: string, source: string, strategy: BranchMergeStrategy) => {
      addCommit(strategy === "squash" ? `Squash merge ${source}` : `Merge ${source}`);
      return "ok";
    }),
    createTag: call("createTag", (_path: string, name: string) => {
      state.tags = [name, ...state.tags];
      return "ok";
    }),
    deleteTag: call("deleteTag", (_path: string, name: string) => {
      state.tags = state.tags.filter((t) => t !== name);
      return "ok";
    }),
    addRemote: call("addRemote", (_path: string, name: string, url: string) => {
      state.remotes = [...state.remotes, { name, url }];
      return "ok";
    }),
    removeRemote: call("removeRemote", (_path: string, name: string) => {
      state.remotes = state.remotes.filter((r) => r.name !== name);
      return "ok";
    }),
    submoduleUpdate: call("submoduleUpdate", () => "ok"),
    stage: call("stage", (_path: string, file: string) => {
      state.status = state.status.map((s) =>
        s.path === file ? { ...s, x: s.x === "?" ? "A" : "M", y: " " } : s,
      );
      return "ok";
    }),
    unstage: call("unstage", (_path: string, file: string) => {
      state.status = state.status.map((s) =>
        s.path === file ? { ...s, x: " ", y: "M" } : s,
      );
      return "ok";
    }),
    stageAll: call("stageAll", () => {
      state.status = state.status.map((s) => ({
        ...s,
        x: s.x === "?" ? "A" : "M",
        y: " ",
      }));
      return "ok";
    }),
    unstageAll: call("unstageAll", () => {
      state.status = state.status.map((s) => ({ ...s, x: " ", y: "M" }));
      return "ok";
    }),
    commit: call("commit", (_path: string, message: string) => {
      state.status = state.status.filter((s) => s.x === " " || s.x === "?");
      addCommit(message);
      return "ok";
    }),
    commitAll: call("commitAll", (_path: string, message: string) => {
      state.status = [];
      addCommit(message);
      return "ok";
    }),
    addToGitignore: call("addToGitignore", (_path: string, file: string) => file),
    stashSave: call("stashSave", () => {
      state.stashes = [
        { index: 0, reff: "stash@{0}", message: `WIP on ${state.info.branch}` },
        ...state.stashes.map((s, i) => ({ ...s, index: i + 1 })),
      ];
      state.status = [];
      return "ok";
    }),
    stashPop: call("stashPop", (_path: string, reff: string) => {
      state.stashes = state.stashes.filter((s) => s.reff !== reff);
      return "ok";
    }),
    stashApply: call("stashApply", () => "ok"),
    stashDrop: call("stashDrop", (_path: string, reff: string) => {
      state.stashes = state.stashes.filter((s) => s.reff !== reff);
      return "ok";
    }),
    fetch: call("fetch", () => "ok"),
    pull: call("pull", () => "ok"),
    push: call("push", () => "ok"),
    onPushProgress: call("onPushProgress", () => () => {}),
    clone: call("clone", (url: string, parentDir: string) => {
      const name = url.replace(/\.git$/, "").split("/").pop() || "repo";
      return `${parentDir}/${name}`;
    }),

    prList: call("prList", () => state.pullRequests),
    prDiff: call("prDiff", (_path: string, number: number) => state.prDiffs[number] ?? ""),
    prCheckout: call("prCheckout", (_path: string, number: number) => {
      const pr = state.pullRequests.find((p) => p.number === number);
      if (pr) state.info = { ...state.info, branch: pr.headRefName };
      return "ok";
    }),
    prReview: call(
      "prReview",
      (_path: string, number: number, verdict: ReviewVerdict) => {
        state.pullRequests = state.pullRequests.map((p) =>
          p.number === number
            ? {
                ...p,
                reviewDecision:
                  verdict === "approve"
                    ? "APPROVED"
                    : verdict === "request-changes"
                      ? "CHANGES_REQUESTED"
                      : p.reviewDecision,
              }
            : p,
        );
        return "ok";
      },
    ),
    prMerge: call("prMerge", (_path: string, number: number) => {
      state.pullRequests = state.pullRequests.filter((p) => p.number !== number);
      return "ok";
    }),

    watchRepo: call("watchRepo", (_path: string, onChange: () => void) => {
      watchers.push(onChange);
      return () => {
        const i = watchers.indexOf(onChange);
        if (i >= 0) watchers.splice(i, 1);
      };
    }),
  };

  return {
    client,
    state,
    calls,
    /** Method names in call order — convenient for coarse assertions. */
    methods: () => calls.map((c) => c.method),
    /** Simulate the file watcher reporting an external repo change. */
    fireRepoChange: () => {
      for (const w of [...watchers]) w();
    },
    /** Number of active watch subscriptions. */
    watcherCount: () => watchers.length,
  };
}
