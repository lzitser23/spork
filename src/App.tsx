import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { Cloud, FolderOpen } from "lucide-react";
import { Toaster, toast } from "sonner";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { TitleBar } from "@/components/TitleBar";
import { Sidebar, type View } from "@/components/Sidebar";
import { CommitList } from "@/components/CommitList";
import { CommitDetail } from "@/components/CommitDetail";
import { DiffView } from "@/components/DiffView";
import { ChangesView } from "@/components/ChangesView";
import { FileBrowser } from "@/components/FileBrowser";
import { CloneDialog } from "@/components/CloneDialog";
import { SporkLogo } from "@/components/SporkLogo";
import { remoteHostLabel, remoteWebUrl } from "@/lib/remote";
import {
  addToGitignore,
  gitBranches,
  gitCheckout,
  gitCommit,
  gitCommitAll,
  gitCreateBranch,
  gitDeleteBranch,
  gitRemoteBranches,
  gitRemoteTips,
  gitStage,
  gitStageAll,
  gitStashApply,
  gitStashDrop,
  gitStashPop,
  gitUnstage,
  gitUnstageAll,
  gitFetch,
  gitLog,
  gitPull,
  gitPush,
  gitRemotes,
  gitStash,
  gitStashes,
  gitStatus,
  gitTags,
  gitAddRemote,
  gitCreateTag,
  gitDeleteTag,
  gitRemoveRemote,
  gitSubmodules,
  gitSubmoduleUpdate,
  openRepo,
  startRepoWatch,
  stopRepoWatch,
  type Branch,
  type Commit,
  type RepoChangedPayload,
  type Remote,
  type RepoInfo,
  type Stash,
  type StatusEntry,
} from "@/lib/git";

function EmptyState({
  onOpen,
  onClone,
  busy,
}: {
  onOpen: () => void;
  onClone: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <div className="flex flex-col items-center">
        <SporkLogo size={76} className="drop-shadow-[0_16px_32px_rgba(0,0,0,0.5)]" />
        <div className="mt-4 text-3xl font-semibold tracking-tight">spork</div>
        <div className="mt-1.5 text-sm text-muted-foreground">
          a small, black, monospace git client
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onOpen} disabled={busy} variant="outline">
          <FolderOpen /> Open a repository
        </Button>
        <Button onClick={onClone} disabled={busy} variant="ghost">
          <Cloud /> Clone from URL
        </Button>
      </div>
    </div>
  );
}

export default function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [submodules, setSubmodules] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusEntry[]>([]);
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [stashes, setStashes] = useState<Stash[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [view, setView] = useState<View>("history");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingPathRef = useRef<string | null>(null);
  const queuedLoadRef = useRef<string | null>(null);
  const selectedHashRef = useRef<string | null>(null);
  // While a user-initiated action runs (and briefly after), suppress the
  // "external change" toast so the action's own ripple doesn't notify.
  const suppressToastUntilRef = useRef(0);

  useEffect(() => {
    selectedHashRef.current = selectedHash;
  }, [selectedHash]);

  const load = useCallback(async (path: string) => {
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
        const info = await openRepo(currentPath);
        const [log, br, rbr, subs, st, rem, tg, stash] = await Promise.all([
          gitLog(info.path, 300),
          gitBranches(info.path),
          gitRemoteBranches(info.path),
          gitSubmodules(info.path),
          gitStatus(info.path),
          gitRemotes(info.path),
          gitTags(info.path),
          gitStashes(info.path),
        ]);
        setRepo(info);
        setCommits(log);
        setBranches(br);
        setRemoteBranches(rbr);
        setSubmodules(subs);
        setStatus(st);
        setRemotes(rem);
        setTags(tg);
        setStashes(stash);
        const previousSelectedHash = selectedHashRef.current;
        const nextSelectedHash =
          previousSelectedHash && log.some((commit) => commit.hash === previousSelectedHash)
            ? previousSelectedHash
            : log[0]?.hash ?? null;
        setSelectedHash(nextSelectedHash);
        if (nextSelectedHash !== previousSelectedHash) setSelectedFile(null);
      } catch (e) {
        setError(String(e));
      } finally {
        loadingPathRef.current = null;
        setBusy(false);
        nextPath = queuedLoadRef.current;
        queuedLoadRef.current = null;
      }
    }
  }, []);

  const chooseRepo = useCallback(async () => {
    const dir = await open({
      directory: true,
      multiple: false,
      title: "Open a Git repository",
    });
    if (typeof dir === "string") await load(dir);
  }, [load]);

  const refresh = useCallback(() => {
    if (repo) void load(repo.path);
  }, [repo, load]);

  const runAction = useCallback(
    async (fn: (p: string) => Promise<string>, label: string) => {
      if (!repo) return;
      suppressToastUntilRef.current = Infinity;
      setBusy(true);
      setError(null);
      try {
        await fn(repo.path);
        await load(repo.path);
      } catch (e) {
        setError(`${label}: ${String(e)}`);
        setBusy(false);
      } finally {
        suppressToastUntilRef.current = Date.now() + 1500;
      }
    },
    [repo, load],
  );

  const checkoutBranch = useCallback(
    (name: string) => {
      void runAction((p) => gitCheckout(p, name), `checkout ${name}`);
    },
    [runAction],
  );

  const createBranch = useCallback(
    (name: string) => {
      const n = name.trim();
      if (n) void runAction((p) => gitCreateBranch(p, n), `create ${n}`);
    },
    [runAction],
  );

  const deleteBranch = useCallback(
    (name: string) => {
      void runAction((p) => gitDeleteBranch(p, name), `delete ${name}`);
    },
    [runAction],
  );

  const checkoutRemote = useCallback(
    (remoteRef: string) => {
      // Strip the remote name → DWIM short name; git creates/switches a local
      // branch tracking the remote.
      const short = remoteRef.replace(/^[^/]+\//, "");
      void runAction((p) => gitCheckout(p, short), `checkout ${short}`);
    },
    [runAction],
  );

  const createTag = useCallback(
    (name: string) => {
      const n = name.trim();
      if (n) void runAction((p) => gitCreateTag(p, n), `tag ${n}`);
    },
    [runAction],
  );
  const deleteTag = useCallback(
    (name: string) => void runAction((p) => gitDeleteTag(p, name), `delete tag ${name}`),
    [runAction],
  );
  const checkoutTag = useCallback(
    (name: string) => void runAction((p) => gitCheckout(p, name), `checkout ${name}`),
    [runAction],
  );
  const addRemote = useCallback(
    (name: string, url: string) => {
      const n = name.trim();
      const u = url.trim();
      if (n && u) void runAction((p) => gitAddRemote(p, n, u), `add remote ${n}`);
    },
    [runAction],
  );
  const removeRemote = useCallback(
    (name: string) => void runAction((p) => gitRemoveRemote(p, name), `remove remote ${name}`),
    [runAction],
  );
  const submoduleUpdate = useCallback(
    () => void runAction(gitSubmoduleUpdate, "submodule update"),
    [runAction],
  );

  const stage = useCallback(
    (file: string) => void runAction((p) => gitStage(p, file), "stage"),
    [runAction],
  );
  const unstage = useCallback(
    (file: string) => void runAction((p) => gitUnstage(p, file), "unstage"),
    [runAction],
  );
  const stageAll = useCallback(() => void runAction(gitStageAll, "stage all"), [runAction]);
  const unstageAll = useCallback(
    () => void runAction(gitUnstageAll, "unstage all"),
    [runAction],
  );

  const commit = useCallback(
    async (message: string, stageAll: boolean, push: boolean): Promise<boolean> => {
      if (!repo) return false;
      suppressToastUntilRef.current = Infinity;
      setBusy(true);
      setError(null);
      try {
        try {
          if (stageAll) await gitCommitAll(repo.path, message);
          else await gitCommit(repo.path, message);
        } catch (e) {
          setError(`commit: ${String(e)}`);
          setBusy(false);
          return false;
        }
        // The commit succeeded; an optional push failing shouldn't undo it.
        let pushErr: string | null = null;
        if (push) {
          try {
            await gitPush(repo.path);
          } catch (e) {
            pushErr = `push: ${String(e)}`;
          }
        }
        await load(repo.path); // reflect the new commit (this also clears the error)
        if (pushErr) setError(pushErr); // ...so re-surface a push failure after it
        return true;
      } finally {
        suppressToastUntilRef.current = Date.now() + 1500;
      }
    },
    [repo, load],
  );

  const gitignore = useCallback(
    (file: string) => void runAction((p) => addToGitignore(p, file), "add to .gitignore"),
    [runAction],
  );

  const stashPop = useCallback(
    (s: Stash) => void runAction((p) => gitStashPop(p, s.reff), "stash pop"),
    [runAction],
  );
  const stashApply = useCallback(
    (s: Stash) => void runAction((p) => gitStashApply(p, s.reff), "stash apply"),
    [runAction],
  );
  const stashDrop = useCallback(
    (s: Stash) => void runAction((p) => gitStashDrop(p, s.reff), "stash drop"),
    [runAction],
  );

  const originRemote = remotes.find((r) => r.name === "origin") ?? remotes[0];
  const webUrl = originRemote ? remoteWebUrl(originRemote.url) : null;
  const hostLabel = (originRemote && remoteHostLabel(originRemote.url)) || "Web";
  const repoPath = repo?.path ?? null;

  useEffect(() => {
    if (!repoPath) {
      void stopRepoWatch().catch(() => {});
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    startRepoWatch(repoPath).catch((e) => {
      if (!cancelled) setError(`watch: ${String(e)}`);
    });

    listen<RepoChangedPayload>("repo_changed", (event) => {
      if (event.payload.path !== repoPath) return;
      // Skip the echo of the user's own action — it already refreshed silently.
      if (Date.now() < suppressToastUntilRef.current) return;
      void load(repoPath);
      toast("Repository changed", { id: "repo-changed" });
    })
      .then((dispose) => {
        if (cancelled) dispose();
        else unlisten = dispose;
      })
      .catch((e) => {
        if (!cancelled) setError(`watch: ${String(e)}`);
      });

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
      void stopRepoWatch().catch(() => {});
    };
  }, [repoPath, load]);

  // Background fetch: every ~2 min, quietly fetch the remote; if its refs moved,
  // refresh (so origin/* commits appear in the graph) and toast. The local-change
  // toast is suppressed during the fetch so its ref churn doesn't double-notify.
  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    let lastTips = "";
    gitRemoteTips(repoPath)
      .then((t) => {
        if (!cancelled) lastTips = t;
      })
      .catch(() => {});

    const tick = async () => {
      if (cancelled) return;
      suppressToastUntilRef.current = Infinity;
      try {
        await gitFetch(repoPath);
        const tips = await gitRemoteTips(repoPath);
        if (!cancelled && tips !== lastTips) {
          const hadBaseline = lastTips !== "";
          lastTips = tips;
          await load(repoPath);
          if (hadBaseline) {
            toast("Remote updated", {
              description: "origin has new commits — Pull to merge",
              id: "remote-updated",
            });
          }
        }
      } catch {
        // Offline / auth failure — skip this round quietly.
      } finally {
        suppressToastUntilRef.current = Date.now() + 1500;
      }
    };

    const interval = setInterval(tick, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [repoPath, load]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-[13px] text-foreground">
      <TitleBar
        repo={repo}
        busy={busy}
        webUrl={webUrl}
        hostLabel={hostLabel}
        onRefresh={refresh}
        onOpen={chooseRepo}
        onClone={() => setCloneOpen(true)}
        onFetch={() => runAction(gitFetch, "fetch")}
        onPull={() => runAction(gitPull, "pull")}
        onPush={() => runAction(gitPush, "push")}
        onStash={() => runAction(gitStash, "stash")}
        onOpenWebUrl={() => {
          if (webUrl) openUrl(webUrl).catch((e) => setError(String(e)));
        }}
      />

      {error && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-destructive">
          {error}
        </div>
      )}

      {repo ? (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel
            defaultSize="260px"
            minSize="180px"
            maxSize="460px"
            groupResizeBehavior="preserve-pixel-size"
          >
            <div className="h-full border-r border-border">
              <Sidebar
                view={view}
                onViewChange={setView}
                branches={branches}
                status={status}
                remotes={remotes}
                tags={tags}
                stashes={stashes}
                remoteBranches={remoteBranches}
                submodules={submodules}
                onCheckoutBranch={checkoutBranch}
                onCreateBranch={createBranch}
                onDeleteBranch={deleteBranch}
                onCheckoutRemote={checkoutRemote}
                onCreateTag={createTag}
                onDeleteTag={deleteTag}
                onCheckoutTag={checkoutTag}
                onAddRemote={addRemote}
                onRemoveRemote={removeRemote}
                onSubmoduleUpdate={submoduleUpdate}
                onStashPop={stashPop}
                onStashApply={stashApply}
                onStashDrop={stashDrop}
                busy={busy}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel>
            {view === "files" ? (
              <FileBrowser repoPath={repo.path} onGitignore={gitignore} />
            ) : view === "changes" ? (
              <ChangesView
                repoPath={repo.path}
                status={status}
                selected={selectedChange}
                onSelect={setSelectedChange}
                onStage={stage}
                onUnstage={unstage}
                onStageAll={stageAll}
                onUnstageAll={unstageAll}
                onCommit={commit}
                onGitignore={gitignore}
                busy={busy}
              />
            ) : (
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize="58%" minSize="20%">
                  <CommitList
                    commits={commits}
                    selected={selectedHash}
                    onSelect={(h) => {
                      selectedHashRef.current = h;
                      setSelectedHash(h);
                      setSelectedFile(null);
                    }}
                  />
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel defaultSize="42%" minSize="15%">
                  {selectedHash ? (
                    <ResizablePanelGroup orientation="horizontal">
                      <ResizablePanel defaultSize="42%" minSize="20%">
                        <div className="h-full border-t border-border">
                          <CommitDetail
                            repoPath={repo.path}
                            hash={selectedHash}
                            selectedFile={selectedFile}
                            onSelectFile={setSelectedFile}
                          />
                        </div>
                      </ResizablePanel>
                      <ResizableHandle />
                      <ResizablePanel defaultSize="58%" minSize="20%">
                        <div className="h-full border-l border-t border-border">
                          <DiffView
                            repoPath={repo.path}
                            target={
                              selectedFile
                                ? { kind: "commit", hash: selectedHash, file: selectedFile }
                                : null
                            }
                          />
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  ) : (
                    <div className="flex h-full items-center justify-center border-t border-border text-muted-foreground/50">
                      select a commit
                    </div>
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <EmptyState onOpen={chooseRepo} onClone={() => setCloneOpen(true)} busy={busy} />
      )}

      {cloneOpen && (
        <CloneDialog
          onClose={() => setCloneOpen(false)}
          onCloned={(p) => {
            setCloneOpen(false);
            void load(p);
          }}
        />
      )}

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast:
              "!bg-background !border !border-border !text-foreground !text-[12px] !rounded-md !font-mono",
          },
        }}
      />
    </div>
  );
}
