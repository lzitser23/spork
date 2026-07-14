import { useCallback, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Check,
  ChevronDown,
  ExternalLink,
  FolderDown,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { DiffText } from "@/components/DiffView";
import { relativeTime } from "@/lib/format";
import { useGit } from "@/lib/gitClient";
import { splitPrDiff, type PrFileDiff } from "@/lib/prDiff";
import { cn } from "@/lib/utils";
import type { MergeStrategy, PullRequest, ReviewVerdict } from "@/lib/git";

/** Pill style for a PR's review state (or draft-ness). */
function decisionPill(pr: PullRequest): { label: string; className: string } | null {
  if (pr.isDraft)
    return { label: "draft", className: "border-muted-foreground/40 text-muted-foreground" };
  switch (pr.reviewDecision) {
    case "APPROVED":
      return {
        label: "approved",
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      };
    case "CHANGES_REQUESTED":
      return {
        label: "changes requested",
        className: "border-amber-500/40 bg-amber-500/10 text-amber-400",
      };
    case "REVIEW_REQUIRED":
      return {
        label: "review required",
        className: "border-sky-500/40 bg-sky-500/10 text-sky-400",
      };
    default:
      return null;
  }
}

function DecisionPill({ pr }: { pr: PullRequest }) {
  const pill = decisionPill(pr);
  if (!pill) return null;
  return (
    <span
      className={cn("shrink-0 rounded border px-1 text-[10px] leading-tight", pill.className)}
    >
      {pill.label}
    </span>
  );
}

/**
 * Setup / failure state for the PR list. The `gh-not-installed` sentinel (and
 * gh's own "please run gh auth login" errors) become instructions instead of
 * a raw error string.
 */
function GhHelp({ error, onRetry }: { error: string; onRetry: () => void }) {
  const notInstalled = error === "gh-not-installed";
  const needsAuth = /auth login|not logged in/i.test(error);
  const installCmd = navigator.userAgent.includes("Mac")
    ? "brew install gh"
    : "winget install GitHub.cli";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 border-t border-border px-6 text-center">
      <GitPullRequest className="size-8 text-muted-foreground/40" />
      <div className="text-sm font-semibold">
        {notInstalled ? "GitHub CLI required" : "couldn't load pull requests"}
      </div>
      <div className="max-w-md text-[12px] text-muted-foreground">
        {notInstalled
          ? "Reviewing pull requests uses the GitHub CLI (gh), which brings its own GitHub sign-in — Spork never stores tokens."
          : error}
      </div>
      {(notInstalled || needsAuth) && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-[12px] text-muted-foreground">
          {notInstalled && (
            <div>
              1. <span className="text-foreground">{installCmd}</span>
            </div>
          )}
          <div>
            {notInstalled ? "2." : "1."}{" "}
            <span className="text-foreground">gh auth login</span>
          </div>
        </div>
      )}
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw /> Try again
      </Button>
    </div>
  );
}

export function PullRequestsView({
  repoPath,
  busy,
  onCheckout,
  onRepoChanged,
}: {
  repoPath: string;
  busy: boolean;
  /** Check out the PR's branch locally (rippling into a snapshot reload). */
  onCheckout: (number: number) => void;
  /** Refresh the main repository model after PR operations that move refs. */
  onRepoChanged: () => Promise<void> | void;
}) {
  const git = useGit();

  const [prs, setPrs] = useState<PullRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const [files, setFiles] = useState<PrFileDiff[] | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const [reviewBody, setReviewBody] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await git.prList(repoPath);
      setPrs(list);
      // Keep the selection while its PR is still open; else pick the first.
      setSelected((s) =>
        s !== null && list.some((p) => p.number === s) ? s : list[0]?.number ?? null,
      );
    } catch (e) {
      setPrs(null);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [git, repoPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const pr = prs?.find((p) => p.number === selected) ?? null;

  // Fetch the selected PR's diff and split it into per-file sections.
  useEffect(() => {
    setFiles(null);
    setDiffError(null);
    setSelectedFile(null);
    if (selected === null) return;
    let cancelled = false;
    git
      .prDiff(repoPath, selected)
      .then((d) => {
        if (cancelled) return;
        const split = splitPrDiff(d);
        setFiles(split);
        setSelectedFile(split[0]?.path ?? null);
      })
      .catch((e) => {
        if (!cancelled) setDiffError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [git, repoPath, selected]);

  /** Run a gh action, toast a failure, and reload the list either way it changed. */
  const act = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      setActing(true);
      try {
        await fn();
        await load();
      } catch (e) {
        toast(`${label}: ${String(e)}`);
      } finally {
        setActing(false);
      }
    },
    [load],
  );

  const review = (verdict: ReviewVerdict) => {
    if (!pr) return;
    const done: Record<ReviewVerdict, string> = {
      approve: "approved",
      comment: "commented on",
      "request-changes": "requested changes on",
    };
    void act(`review #${pr.number}`, async () => {
      await git.prReview(repoPath, pr.number, verdict, reviewBody);
      setReviewBody("");
      toast(`${done[verdict]} #${pr.number}`);
    });
  };

  const merge = (strategy: MergeStrategy) => {
    if (!pr) return;
    void act(`merge #${pr.number}`, async () => {
      await git.prMerge(repoPath, pr.number, strategy);
      // Toast as soon as the merge lands; the snapshot refresh can lag behind.
      toast(`merged #${pr.number}`);
      await onRepoChanged();
    });
  };

  const openOnGitHub = () => {
    if (pr) void openUrl(pr.url).catch((e) => toast(`open link: ${String(e)}`));
  };

  const disabled = busy || acting;

  if (error) return <GhHelp error={error} onRetry={() => void load()} />;
  if (prs === null)
    return (
      <div className="flex h-full items-center justify-center border-t border-border text-muted-foreground/60">
        loading pull requests…
      </div>
    );
  if (prs.length === 0)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border-t border-border text-center">
        <GitPullRequest className="size-8 text-muted-foreground/40" />
        <div className="text-muted-foreground/60">no open pull requests</div>
        <div className="max-w-sm text-[11px] text-muted-foreground/40">
          pull requests opened against the GitHub remote appear here
        </div>
        <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : undefined} /> Refresh
        </Button>
      </div>
    );

  const file = files?.find((f) => f.path === selectedFile) ?? null;

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize="320px" minSize="240px" maxSize="500px">
        <div className="flex h-full flex-col border-t border-border">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
            <span>Open pull requests</span>
            <span className="tabular-nums">{prs.length}</span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh pull requests"
              className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {prs.map((p) => (
              <button
                key={p.number}
                onClick={() => setSelected(p.number)}
                className={cn(
                  "flex w-full flex-col gap-0.5 px-3 py-1.5 text-left",
                  selected === p.number ? "bg-muted" : "hover:bg-muted/40",
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="shrink-0 text-muted-foreground/60">#{p.number}</span>
                </span>
                <span className="flex w-full items-center gap-2 text-[11px] text-muted-foreground/70">
                  <span className="truncate">{p.author.login}</span>
                  <DecisionPill pr={p} />
                  <span className="ml-auto shrink-0 text-emerald-400">+{p.additions}</span>
                  <span className="shrink-0 text-red-400">−{p.deletions}</span>
                  <span className="shrink-0 text-muted-foreground/50">
                    {relativeTime(Date.parse(p.updatedAt) / 1000)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel>
        <div className="flex h-full flex-col border-l border-t border-border">
          {!pr ? (
            <div className="flex h-full items-center justify-center text-muted-foreground/50">
              select a pull request
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-border px-3 py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold">{pr.title}</span>
                      <span className="shrink-0 text-muted-foreground">#{pr.number}</span>
                      <DecisionPill pr={pr} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{pr.author.login}</span>
                      <span>wants to merge</span>
                      <Badge variant="outline" className="font-normal">
                        {pr.headRefName}
                      </Badge>
                      <span>into</span>
                      <Badge variant="outline" className="font-normal">
                        {pr.baseRefName}
                      </Badge>
                      <span className="text-emerald-400">+{pr.additions}</span>
                      <span className="text-red-400">−{pr.deletions}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => onCheckout(pr.number)}
                      disabled={disabled}
                      title="Check out this PR's branch locally"
                    >
                      <FolderDown /> Checkout
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={openOnGitHub}
                      title="Open this PR on GitHub"
                    >
                      <ExternalLink /> View
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={disabled || pr.isDraft}
                        render={<Button size="xs" variant="outline" />}
                      >
                        <GitMerge /> Merge <ChevronDown className="size-3" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4}>
                        <DropdownMenuItem onClick={() => merge("merge")}>
                          Create a merge commit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => merge("squash")}>
                          Squash and merge
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => merge("rebase")}>
                          Rebase and merge
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {(pr.body ?? "").trim() && (
                  <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[12px] text-muted-foreground">
                    {pr.body}
                  </div>
                )}

                <div className="mt-2 flex items-start gap-1.5">
                  <textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="Review comment… (required to comment or request changes)"
                    rows={2}
                    spellCheck={false}
                    className="min-w-0 flex-1 resize-none rounded-md border border-border bg-transparent px-2 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground/40 focus:border-muted-foreground/40"
                  />
                  <div className="flex shrink-0 flex-col items-stretch gap-1">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => review("approve")}
                    >
                      <Check /> Approve
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={disabled || !reviewBody.trim()}
                      onClick={() => review("comment")}
                    >
                      <MessageSquare /> Comment
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={disabled || !reviewBody.trim()}
                      onClick={() => review("request-changes")}
                    >
                      <X /> Request changes
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1">
                {diffError ? (
                  <div className="p-3 text-destructive">{diffError}</div>
                ) : files === null ? (
                  <div className="p-3 text-muted-foreground/60">loading diff…</div>
                ) : files.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground/50">
                    no changes
                  </div>
                ) : (
                  <ResizablePanelGroup orientation="horizontal">
                    <ResizablePanel defaultSize="34%" minSize="20%">
                      <div className="h-full overflow-y-auto py-1">
                        {files.map((f) => (
                          <button
                            key={f.path}
                            onClick={() => setSelectedFile(f.path)}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-1 text-left",
                              selectedFile === f.path ? "bg-muted" : "hover:bg-muted/40",
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                              {f.path}
                            </span>
                            <span className="shrink-0 text-[11px] text-emerald-400">
                              +{f.additions}
                            </span>
                            <span className="shrink-0 text-[11px] text-red-400">
                              −{f.deletions}
                            </span>
                          </button>
                        ))}
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel>
                      <div className="h-full border-l border-border">
                        {file ? (
                          <DiffText diff={file.diff} file={file.path} />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground/50">
                            select a file to view its diff
                          </div>
                        )}
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                )}
              </div>
            </>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
