import { useCallback, useEffect, useState, type ReactElement } from "react";
import { getCurrentWindow, type Window as TauriWindow } from "@tauri-apps/api/window";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  GitBranch,
  Minus,
  RefreshCw,
  Square,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RepoInfo } from "@/lib/git";
import { cn } from "@/lib/utils";

export interface WindowChromeClient {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onResized: (handler: () => void) => Promise<() => void>;
}

function hasTauriWindow(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

async function withCurrentWindow(action: (currentWindow: TauriWindow) => Promise<void>) {
  if (!hasTauriWindow()) return;
  await action(getCurrentWindow());
}

export const tauriWindowChrome: WindowChromeClient = {
  minimize: () => withCurrentWindow((currentWindow) => currentWindow.minimize()),
  toggleMaximize: () => withCurrentWindow((currentWindow) => currentWindow.toggleMaximize()),
  close: () => withCurrentWindow((currentWindow) => currentWindow.close()),
  isMaximized: async () => (hasTauriWindow() ? getCurrentWindow().isMaximized() : false),
  onResized: async (handler) => {
    if (!hasTauriWindow()) return () => {};
    return getCurrentWindow().onResized(() => handler());
  },
};

function repoBasename(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function Hint({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function WindowControl({
  label,
  onClick,
  children,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: ReactElement;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-10 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        destructive && "hover:bg-destructive hover:text-destructive-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar({
  repo,
  busy,
  webUrl,
  hostLabel,
  recentRepos,
  onOpenRecent,
  onRefresh,
  onOpen,
  onClone,
  onFetch,
  onPull,
  onPush,
  onStash,
  onOpenWebUrl,
  windowChrome = tauriWindowChrome,
}: {
  repo: RepoInfo | null;
  busy: boolean;
  webUrl: string | null;
  hostLabel: string;
  /** Recently opened repo roots, most recent first. */
  recentRepos: string[];
  onOpenRecent: (path: string) => void;
  onRefresh: () => void;
  onOpen: () => void;
  onClone: () => void;
  onFetch: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
  onStash: () => void | Promise<void>;
  onOpenWebUrl: () => void;
  windowChrome?: WindowChromeClient;
}) {
  const [maximized, setMaximized] = useState(false);

  const refreshMaximized = useCallback(async () => {
    try {
      setMaximized(await windowChrome.isMaximized());
    } catch (error) {
      console.error("window isMaximized failed", error);
    }
  }, [windowChrome]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    windowChrome
      .isMaximized()
      .then((isMaximized) => {
        if (!cancelled) setMaximized(isMaximized);
      })
      .catch((error) => console.error("window isMaximized failed", error));

    windowChrome
      .onResized(() => {
        void refreshMaximized();
      })
      .then((dispose) => {
        if (cancelled) dispose();
        else unsubscribe = dispose;
      })
      .catch((error) => console.error("window resize listener failed", error));

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [refreshMaximized, windowChrome]);

  const runWindowControl = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      console.error("window control failed", error);
    }
  }, []);

  const toggleMaximize = useCallback(async () => {
    await runWindowControl(windowChrome.toggleMaximize);
    await refreshMaximized();
  }, [refreshMaximized, runWindowControl, windowChrome]);

  return (
    <header
      data-testid="title-bar"
      data-tauri-drag-region="deep"
      className="flex h-10 shrink-0 select-none items-center border-b border-border bg-background text-[13px]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <span className="shrink-0 font-semibold tracking-tight text-muted-foreground">
          spork
        </span>

        {repo && (
          <>
            <Separator orientation="vertical" className="h-4 shrink-0" />
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="repo-switcher"
                data-tauri-drag-region="false"
                className="-mx-1 flex min-w-0 items-center gap-1 rounded-sm px-1 py-0.5 text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted/70"
              >
                <span className="min-w-0 truncate">{repo.name}</span>
                <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className="max-w-md">
                <DropdownMenuLabel>recent repositories</DropdownMenuLabel>
                {recentRepos.map((path) => {
                  const isCurrent = path === repo.path;
                  return (
                    <DropdownMenuItem
                      key={path}
                      disabled={busy}
                      onClick={() => {
                        if (!isCurrent) onOpenRecent(path);
                      }}
                    >
                      <Check
                        className={cn("size-3", isCurrent ? "opacity-100" : "opacity-0")}
                      />
                      <span className="shrink-0">{repoBasename(path)}</span>
                      <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
                        {path}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
                {recentRepos.length === 0 && (
                  <DropdownMenuItem disabled>no recent repositories</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Badge variant="outline" className="gap-1 font-normal">
              <GitBranch className="size-3" />
              {repo.branch}
            </Badge>
            {repo.head && (
              <span className="hidden shrink-0 text-muted-foreground sm:inline">
                {repo.head}
              </span>
            )}
          </>
        )}

        <div
          data-testid="title-bar-actions"
          data-tauri-drag-region="false"
          className="ml-auto flex min-w-0 items-center gap-1.5"
        >
          {repo && (
            <>
              <Separator orientation="vertical" className="h-4 shrink-0" />
              <Hint label="Fetch all remotes & prune">
                <Button size="xs" variant="ghost" onClick={onFetch} disabled={busy}>
                  <Download /> Fetch
                </Button>
              </Hint>
              <Hint label="Pull (fast-forward only)">
                <Button size="xs" variant="ghost" onClick={onPull} disabled={busy}>
                  <ArrowDown /> Pull
                </Button>
              </Hint>
              <Hint label="Push the current branch">
                <Button size="xs" variant="ghost" onClick={onPush} disabled={busy}>
                  <ArrowUp /> Push
                </Button>
              </Hint>
              <Hint label="Stash working-tree changes (git stash)">
                <Button size="xs" variant="ghost" onClick={onStash} disabled={busy}>
                  <Archive /> Stash
                </Button>
              </Hint>
              {webUrl && (
                <Hint label={`Open on ${hostLabel} in your browser`}>
                  <Button size="xs" variant="ghost" onClick={onOpenWebUrl}>
                    <ExternalLink /> {hostLabel}
                  </Button>
                </Hint>
              )}
              <Hint label="Refresh">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={onRefresh}
                  disabled={busy}
                  aria-label="Refresh"
                >
                  <RefreshCw className={busy ? "animate-spin" : undefined} />
                </Button>
              </Hint>

              {/* Once a repo is open the empty-state CTAs are gone, so the title
                  bar is the only place to switch to another repo. */}
              <Separator orientation="vertical" className="h-4 shrink-0" />
              <Hint label="Clone a repository from a URL">
                <Button size="sm" variant="ghost" onClick={onClone} disabled={busy}>
                  <Cloud /> Clone
                </Button>
              </Hint>
              <Hint label="Open a local repository">
                <Button size="sm" variant="outline" onClick={onOpen} disabled={busy}>
                  <FolderOpen /> Open
                </Button>
              </Hint>
            </>
          )}
        </div>
      </div>

      <div
        data-testid="window-controls"
        data-tauri-drag-region="false"
        className="flex h-full shrink-0 border-l border-border/70"
      >
        <WindowControl
          label="Minimize window"
          onClick={() => void runWindowControl(windowChrome.minimize)}
        >
          <Minus className="size-4" />
        </WindowControl>
        <WindowControl
          label={maximized ? "Restore window" : "Maximize window"}
          onClick={() => void toggleMaximize()}
        >
          {maximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
        </WindowControl>
        <WindowControl
          label="Close window"
          onClick={() => void runWindowControl(windowChrome.close)}
          destructive
        >
          <X className="size-4" />
        </WindowControl>
      </div>
    </header>
  );
}
