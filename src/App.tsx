import { useCallback, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  RefreshCw,
} from "lucide-react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  gitBranches,
  gitLog,
  gitStatus,
  openRepo,
  type Branch,
  type Commit,
  type RepoInfo,
  type StatusEntry,
} from "@/lib/git";

function relativeTime(unixSeconds: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EmptyState({ onOpen, busy }: { onOpen: () => void; busy: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <div>
        <div className="text-3xl font-semibold tracking-tight">spoon</div>
        <div className="mt-1.5 text-sm text-muted-foreground">
          a small, black, monospace git client
        </div>
      </div>
      <Button onClick={onOpen} disabled={busy} variant="outline">
        <FolderOpen /> Open a repository
      </Button>
    </div>
  );
}

export default function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState<StatusEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (path: string) => {
    setBusy(true);
    setError(null);
    try {
      const info = await openRepo(path);
      const [log, br, st] = await Promise.all([
        gitLog(info.path, 200),
        gitBranches(info.path),
        gitStatus(info.path),
      ]);
      setRepo(info);
      setCommits(log);
      setBranches(br);
      setStatus(st);
      setSelected(log[0]?.hash ?? null);
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-[13px] text-foreground">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="font-semibold tracking-tight text-muted-foreground">
          spoon
        </span>

        {repo && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-foreground">{repo.name}</span>
            <Badge variant="outline" className="gap-1 font-normal">
              <GitBranch className="size-3" />
              {repo.branch}
            </Badge>
            {repo.head && (
              <span className="text-muted-foreground">{repo.head}</span>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {repo && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={refresh}
              disabled={busy}
              aria-label="Refresh"
            >
              <RefreshCw className={busy ? "animate-spin" : undefined} />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={chooseRepo}
            disabled={busy}
          >
            <FolderOpen /> Open
          </Button>
        </div>
      </header>

      {error && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-destructive">
          {error}
        </div>
      )}

      {repo ? (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize={24} minSize={15} maxSize={40}>
            <ScrollArea className="h-full">
              <div className="p-1.5">
                <SectionLabel>Branches</SectionLabel>
                {branches.map((b) => (
                  <div
                    key={b.name}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1",
                      b.is_current
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <GitBranch className="size-3 shrink-0" />
                    <span className="truncate">{b.name}</span>
                  </div>
                ))}

                <SectionLabel>Changes · {status.length}</SectionLabel>
                {status.length === 0 ? (
                  <div className="px-2 py-1 text-muted-foreground/70">
                    working tree clean
                  </div>
                ) : (
                  status.map((s, i) => (
                    <div
                      key={`${s.path}-${i}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1"
                    >
                      <span className="w-5 shrink-0 text-center text-amber-500">
                        {(s.x + s.y).trim() || "?"}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {s.path}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={76}>
            <ScrollArea className="h-full">
              {commits.map((c) => (
                <button
                  key={c.hash}
                  onClick={() => setSelected(c.hash)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border/30 px-3 py-1.5 text-left",
                    selected === c.hash ? "bg-muted" : "hover:bg-muted/40",
                  )}
                >
                  <GitCommitHorizontal className="size-3.5 shrink-0 text-muted-foreground/70" />
                  <span className="shrink-0 text-muted-foreground">
                    {c.short_hash}
                  </span>
                  <span className="flex-1 truncate">{c.subject}</span>
                  <span className="shrink-0 truncate text-muted-foreground/80">
                    {c.author_name}
                  </span>
                  <span className="w-10 shrink-0 text-right text-muted-foreground/60">
                    {relativeTime(c.timestamp)}
                  </span>
                </button>
              ))}
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <EmptyState onOpen={chooseRepo} busy={busy} />
      )}
    </div>
  );
}
