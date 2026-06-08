import { useCallback, useState, type ReactElement } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Cloud,
  Download,
  ExternalLink,
  FolderOpen,
  GitBranch,
  RefreshCw,
} from "lucide-react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  type Branch,
  type Commit,
  type Remote,
  type RepoInfo,
  type Stash,
  type StatusEntry,
} from "@/lib/git";

/** Wrap any single element with a hover tooltip. */
function Hint({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

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

  const load = useCallback(async (path: string) => {
    setBusy(true);
    setError(null);
    try {
      const info = await openRepo(path);
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
      setSelectedHash(log[0]?.hash ?? null);
      setSelectedFile(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-[13px] text-foreground">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="font-semibold tracking-tight text-muted-foreground">spork</span>

        {repo && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-foreground">{repo.name}</span>
            <Badge variant="outline" className="gap-1 font-normal">
              <GitBranch className="size-3" />
              {repo.branch}
            </Badge>
            {repo.head && <span className="text-muted-foreground">{repo.head}</span>}

            <Separator orientation="vertical" className="h-4" />
            <Hint label="Fetch all remotes & prune">
              <Button size="xs" variant="ghost" onClick={() => runAction(gitFetch, "fetch")} disabled={busy}>
                <Download /> Fetch
              </Button>
            </Hint>
            <Hint label="Pull (fast-forward only)">
              <Button size="xs" variant="ghost" onClick={() => runAction(gitPull, "pull")} disabled={busy}>
                <ArrowDown /> Pull
              </Button>
            </Hint>
            <Hint label="Push the current branch">
              <Button size="xs" variant="ghost" onClick={() => runAction(gitPush, "push")} disabled={busy}>
                <ArrowUp /> Push
              </Button>
            </Hint>
            <Hint label="Stash working-tree changes (git stash)">
              <Button size="xs" variant="ghost" onClick={() => runAction(gitStash, "stash")} disabled={busy}>
                <Archive /> Stash
              </Button>
            </Hint>
            {webUrl && (
              <Hint label={`Open on ${hostLabel} in your browser`}>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => openUrl(webUrl).catch((e) => setError(String(e)))}
                >
                  <ExternalLink /> {hostLabel}
                </Button>
              </Hint>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {repo && (
            <Hint label="Refresh">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={refresh}
                disabled={busy}
                aria-label="Refresh"
              >
                <RefreshCw className={busy ? "animate-spin" : undefined} />
              </Button>
            </Hint>
          )}
          <Hint label="Clone a repository from a URL">
            <Button size="sm" variant="ghost" onClick={() => setCloneOpen(true)} disabled={busy}>
              <Cloud /> Clone
            </Button>
          </Hint>
          <Hint label="Open a local repository">
            <Button size="sm" variant="outline" onClick={chooseRepo} disabled={busy}>
              <FolderOpen /> Open
            </Button>
          </Hint>
        </div>
      </header>

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
