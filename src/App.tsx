import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { Cloud, FolderOpen } from "lucide-react";

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
import { FileBrowser } from "@/components/FileBrowser";
import { CloneDialog } from "@/components/CloneDialog";
import { remoteHostLabel, remoteWebUrl } from "@/lib/remote";
import {
  gitBranches,
  gitFetch,
  gitLog,
  gitPull,
  gitPush,
  gitRemotes,
  gitStash,
  gitStashes,
  gitStatus,
  gitTags,
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
      <div>
        <div className="text-3xl font-semibold tracking-tight">spork</div>
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
  const [status, setStatus] = useState<StatusEntry[]>([]);
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [stashes, setStashes] = useState<Stash[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [view, setView] = useState<View>("history");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingPathRef = useRef<string | null>(null);
  const queuedLoadRef = useRef<string | null>(null);
  const selectedHashRef = useRef<string | null>(null);

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
        const [log, br, st, rem, tg, stash] = await Promise.all([
          gitLog(info.path, 300),
          gitBranches(info.path),
          gitStatus(info.path),
          gitRemotes(info.path),
          gitTags(info.path),
          gitStashes(info.path),
        ]);
        setRepo(info);
        setCommits(log);
        setBranches(br);
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
      setBusy(true);
      setError(null);
      try {
        await fn(repo.path);
        await load(repo.path);
      } catch (e) {
        setError(`${label}: ${String(e)}`);
        setBusy(false);
      }
    },
    [repo, load],
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
      if (event.payload.path === repoPath) void load(repoPath);
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
              />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel>
            {view === "files" ? (
              <FileBrowser repoPath={repo.path} />
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
                          <DiffView repoPath={repo.path} hash={selectedHash} file={selectedFile} />
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
    </div>
  );
}
