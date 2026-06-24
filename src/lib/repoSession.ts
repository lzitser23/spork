import { useCallback, useEffect, useRef, useState } from "react";

import { useGit, type GitClient } from "@/lib/gitClient";
import type {
  Branch,
  Commit,
  Remote,
  RepoInfo,
  Stash,
  StatusEntry,
} from "@/lib/git";

/** Everything the UI renders about the open repository, loaded as one unit. */
export interface RepoSnapshot {
  info: RepoInfo;
  commits: Commit[];
  branches: Branch[];
  remoteBranches: string[];
  submodules: string[];
  status: StatusEntry[];
  remotes: Remote[];
  tags: string[];
  stashes: Stash[];
}

export type SessionEvent = "external-change" | "remote-updated";

export interface RepoSessionOptions {
  /** Called when the repo changed outside the app (watcher / remote fetch). */
  notify?: (event: SessionEvent) => void;
  /** Background remote-fetch cadence in ms; 0 disables it. */
  fetchIntervalMs?: number;
}

export interface RepoSession {
  snapshot: RepoSnapshot | null;
  busy: boolean;
  error: string | null;
  /** The selected commit; preserved across refreshes while it still exists. */
  selectedHash: string | null;
  selectHash(hash: string): void;
  /** Open (or re-open) the repo at `path`. */
  open(path: string): Promise<void>;
  /** Reload the current snapshot. */
  refresh(): void;
  /**
   * Run a git action against the open repo, then reload. A failure surfaces
   * as `error`, prefixed with `label`. External-change notifications are
   * suppressed while the action's own ripple settles.
   */
  run(label: string, fn: (git: GitClient, repoPath: string) => Promise<unknown>): Promise<void>;
  /**
   * Commit the staged changes (or everything, with `stageAll`), optionally
   * pushing after. Returns whether the commit itself succeeded — a failed
   * push doesn't undo a successful commit, it just surfaces as `error`.
   */
  commit(message: string, stageAll: boolean, push: boolean): Promise<boolean>;
}

/** How long after a user action the external-change notification stays muted. */
const SUPPRESS_TAIL_MS = 1500;

/**
 * The repo state machine behind the UI: queued/deduped loads, selection
 * preservation, file watching, and the background remote fetch all live here,
 * behind a snapshot-in / actions-out interface.
 */
export function useRepoSession(options: RepoSessionOptions = {}): RepoSession {
  const { notify, fetchIntervalMs = 120_000 } = options;
  const git = useGit();

  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  const loadingPathRef = useRef<string | null>(null);
  const queuedLoadRef = useRef<string | null>(null);
  const selectedHashRef = useRef<string | null>(null);
  // While a user-initiated action runs (and briefly after), suppress the
  // external-change notification so the action's own ripple doesn't notify.
  const suppressNotifyUntilRef = useRef(0);
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  });

  const load = useCallback(
    async (path: string) => {
      if (loadingPathRef.current) {
        queuedLoadRef.current = path;
        return;
      }

      let nextPath: string | null = path;
      while (nextPath) {
        const currentPath = nextPath;
        nextPath = null;
        queuedLoadRef.current = null;
        loadingPathRef.current = currentPath;
        setBusy(true);
        setError(null);
        try {
          const info = await git.openRepo(currentPath);
          const [commits, branches, remoteBranches, submodules, status, remotes, tags, stashes] =
            await Promise.all([
              git.log(info.path, 300),
              git.branches(info.path),
              git.remoteBranches(info.path),
              git.submodules(info.path),
              git.status(info.path),
              git.remotes(info.path),
              git.tags(info.path),
              git.stashes(info.path),
            ]);
          setSnapshot({
            info,
            commits,
            branches,
            remoteBranches,
            submodules,
            status,
            remotes,
            tags,
            stashes,
          });
          const previous = selectedHashRef.current;
          const next =
            previous && commits.some((c) => c.hash === previous)
              ? previous
              : commits[0]?.hash ?? null;
          selectedHashRef.current = next;
          setSelectedHash(next);
        } catch (e) {
          setError(String(e));
        } finally {
          loadingPathRef.current = null;
          setBusy(false);
          nextPath = queuedLoadRef.current;
          queuedLoadRef.current = null;
        }
      }
    },
    [git],
  );

  const repoPath = snapshot?.info.path ?? null;

  const refresh = useCallback(() => {
    if (repoPath) void load(repoPath);
  }, [repoPath, load]);

  const run = useCallback(
    async (label: string, fn: (git: GitClient, repoPath: string) => Promise<unknown>) => {
      if (!repoPath) return;
      suppressNotifyUntilRef.current = Infinity;
      setBusy(true);
      setError(null);
      try {
        await fn(git, repoPath);
        await load(repoPath);
      } catch (e) {
        setError(`${label}: ${String(e)}`);
        setBusy(false);
      } finally {
        suppressNotifyUntilRef.current = Date.now() + SUPPRESS_TAIL_MS;
      }
    },
    [git, repoPath, load],
  );

  const commit = useCallback(
    async (message: string, stageAll: boolean, push: boolean): Promise<boolean> => {
      if (!repoPath) return false;
      suppressNotifyUntilRef.current = Infinity;
      setBusy(true);
      setError(null);
      try {
        try {
          if (stageAll) await git.commitAll(repoPath, message);
          else await git.commit(repoPath, message);
        } catch (e) {
          setError(`commit: ${String(e)}`);
          setBusy(false);
          return false;
        }
        // The commit succeeded; an optional push failing shouldn't undo it.
        let pushErr: string | null = null;
        if (push) {
          try {
            await git.push(repoPath);
          } catch (e) {
            pushErr = `push: ${String(e)}`;
          }
        }
        await load(repoPath); // reflect the new commit (this also clears the error)
        if (pushErr) setError(pushErr); // ...so re-surface a push failure after it
        return true;
      } finally {
        suppressNotifyUntilRef.current = Date.now() + SUPPRESS_TAIL_MS;
      }
    },
    [git, repoPath, load],
  );

  const selectHash = useCallback((hash: string) => {
    // Set the ref synchronously so an in-flight load preserves the new choice.
    selectedHashRef.current = hash;
    setSelectedHash(hash);
  }, []);

  // Watch the repo for external changes (editor saves, CLI commits, …).
  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    let stop: (() => void) | null = null;

    git
      .watchRepo(repoPath, () => {
        if (cancelled) return;
        // Skip the echo of the user's own action — and of our own reload. A
        // reload runs `git status`, which rewrites `.git/index` (filtered by the
        // backend) and churns the `.git` dir; muting the watcher for the reload
        // plus a short tail keeps any straggling event from re-entering here and
        // queueing reload after reload, which would pin the app permanently
        // "busy". Same guard run()/commit()/the background fetch already use.
        if (Date.now() < suppressNotifyUntilRef.current) return;
        suppressNotifyUntilRef.current = Infinity;
        notifyRef.current?.("external-change");
        void load(repoPath).finally(() => {
          suppressNotifyUntilRef.current = Date.now() + SUPPRESS_TAIL_MS;
        });
      })
      .then((s) => {
        if (cancelled) s();
        else stop = s;
      })
      .catch((e) => {
        if (!cancelled) setError(`watch: ${String(e)}`);
      });

    return () => {
      cancelled = true;
      if (stop) stop();
    };
  }, [git, repoPath, load]);

  // Background fetch: quietly fetch the remote on an interval; if its refs
  // moved, refresh (so origin/* commits appear in the graph) and notify. The
  // external-change notification is suppressed during the fetch so its ref
  // churn doesn't double-notify.
  useEffect(() => {
    if (!repoPath || fetchIntervalMs <= 0) return;
    let cancelled = false;
    let lastTips = "";
    git
      .remoteTips(repoPath)
      .then((t) => {
        if (!cancelled) lastTips = t;
      })
      .catch(() => {});

    const tick = async () => {
      if (cancelled) return;
      suppressNotifyUntilRef.current = Infinity;
      try {
        await git.fetch(repoPath);
        const tips = await git.remoteTips(repoPath);
        if (!cancelled && tips !== lastTips) {
          const hadBaseline = lastTips !== "";
          lastTips = tips;
          await load(repoPath);
          if (hadBaseline) notifyRef.current?.("remote-updated");
        }
      } catch {
        // Offline / auth failure — skip this round quietly.
      } finally {
        suppressNotifyUntilRef.current = Date.now() + SUPPRESS_TAIL_MS;
      }
    };

    const interval = setInterval(tick, fetchIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [git, repoPath, load, fetchIntervalMs]);

  return {
    snapshot,
    busy,
    error,
    selectedHash,
    selectHash,
    open: load,
    refresh,
    run,
    commit,
  };
}
