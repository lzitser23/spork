import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
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
import { PullRequestsView } from "@/components/PullRequestsView";
import { CloneDialog } from "@/components/CloneDialog";
import { MergeDialog, PromptDialog } from "@/components/Modal";
import type { CommitActions } from "@/components/ContextMenu";
import { SporkLogo } from "@/components/SporkLogo";
import { remoteHostLabel, remoteWebUrl } from "@/lib/remote";
import { useGit } from "@/lib/gitClient";
import { forgetRepo, recentRepos, rememberRepo } from "@/lib/recentRepos";
import { useRepoSession, type SessionEvent } from "@/lib/repoSession";
import type { BranchMergeStrategy, Stash } from "@/lib/git";

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

function notifyToast(event: SessionEvent) {
  if (event === "external-change") {
    toast("Repository changed", { id: "repo-changed" });
  } else {
    toast("Remote updated", {
      description: "origin has new commits — Pull to merge",
      id: "remote-updated",
    });
  }
}

export default function App() {
  const git = useGit();
  const session = useRepoSession({ notify: notifyToast });
  const { snapshot, busy, error, selectedHash, selectHash, run, refresh } = session;

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [view, setView] = useState<View>("history");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => recentRepos());
  // Name-entry dialog for a commit's "branch/tag here" action.
  const [prompt, setPrompt] = useState<{ kind: "branch" | "tag"; hash: string } | null>(null);
  // Branch-merge dialog target, set when one branch is dropped onto another.
  const [mergeReq, setMergeReq] = useState<{ source: string; target: string } | null>(null);

  // A different commit means its file list no longer applies.
  useEffect(() => {
    setSelectedFile(null);
  }, [selectedHash]);

  // Every successfully opened repo goes to the front of the recent list
  // (snapshot.info.path is the resolved repo root, so entries are canonical).
  const repoPath = snapshot?.info.path ?? null;
  useEffect(() => {
    if (repoPath) setRecent(rememberRepo(repoPath));
  }, [repoPath]);

  // On launch, reopen the repo from the previous session. Probe it first so a
  // repo that has vanished since then falls back to the welcome screen
  // quietly instead of greeting the user with an error.
  useEffect(() => {
    const last = recentRepos()[0];
    if (!last) return;
    let cancelled = false;
    git.openRepo(last).then(
      () => {
        if (!cancelled) void session.open(last);
      },
      () => {
        if (!cancelled) setRecent(forgetRepo(last));
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRecent = useCallback(
    async (path: string) => {
      if (path === repoPath) return;
      try {
        // Probe before switching so a dead entry doesn't replace the open repo.
        await git.openRepo(path);
      } catch (e) {
        setRecent(forgetRepo(path));
        toast(`open: ${String(e)}`);
        return;
      }
      await session.open(path);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [git, repoPath, session.open],
  );

  const chooseRepo = useCallback(async () => {
    const dir = await open({
      directory: true,
      multiple: false,
      title: "Open a Git repository",
    });
    if (typeof dir === "string") await session.open(dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.open]);

  const checkoutBranch = useCallback(
    (name: string) => void run(`checkout ${name}`, (g, p) => g.checkout(p, name)),
    [run],
  );
  const createBranch = useCallback(
    (name: string) => {
      const n = name.trim();
      if (n) void run(`create ${n}`, (g, p) => g.createBranch(p, n));
    },
    [run],
  );
  const deleteBranch = useCallback(
    (name: string) => void run(`delete ${name}`, (g, p) => g.deleteBranch(p, name)),
    [run],
  );
  const checkoutRemote = useCallback(
    (remoteRef: string) => {
      // Strip the remote name → DWIM short name; git creates/switches a local
      // branch tracking the remote.
      const short = remoteRef.replace(/^[^/]+\//, "");
      void run(`checkout ${short}`, (g, p) => g.checkout(p, short));
    },
    [run],
  );
  const createTag = useCallback(
    (name: string) => {
      const n = name.trim();
      if (n) void run(`tag ${n}`, (g, p) => g.createTag(p, n));
    },
    [run],
  );
  const deleteTag = useCallback(
    (name: string) => void run(`delete tag ${name}`, (g, p) => g.deleteTag(p, name)),
    [run],
  );
  const checkoutTag = useCallback(
    (name: string) => void run(`checkout ${name}`, (g, p) => g.checkout(p, name)),
    [run],
  );
  const addRemote = useCallback(
    (name: string, url: string) => {
      const n = name.trim();
      const u = url.trim();
      if (n && u) void run(`add remote ${n}`, (g, p) => g.addRemote(p, n, u));
    },
    [run],
  );
  const removeRemote = useCallback(
    (name: string) => void run(`remove remote ${name}`, (g, p) => g.removeRemote(p, name)),
    [run],
  );
  const submoduleUpdate = useCallback(
    () => void run("submodule update", (g, p) => g.submoduleUpdate(p)),
    [run],
  );

  // Right-click actions on a commit. The two that need a name open a dialog;
  // the rest run straight through the session (refresh + error handling free).
  const short = (hash: string) => hash.slice(0, 7);
  const commitActions: CommitActions = useMemo(
    () => ({
      onCheckout: (hash) => void run(`checkout ${short(hash)}`, (g, p) => g.checkout(p, hash)),
      onCreateBranch: (hash) => setPrompt({ kind: "branch", hash }),
      onCherryPick: (hash) =>
        void run(`cherry-pick ${short(hash)}`, (g, p) => g.cherryPick(p, hash)),
      onRevert: (hash) => void run(`revert ${short(hash)}`, (g, p) => g.revert(p, hash)),
      onReset: (hash, mode) =>
        void run(`reset --${mode} ${short(hash)}`, (g, p) => g.reset(p, hash, mode)),
      onTag: (hash) => setPrompt({ kind: "tag", hash }),
    }),
    [run],
  );

  // Drag-drop merge: dropping `source` onto `target` merges source into target.
  // Merging happens on the target, so check it out first when it isn't current.
  const mergeBranches = useCallback(
    (source: string, target: string, strategy: BranchMergeStrategy) => {
      const targetIsCurrent =
        snapshot?.branches.some((b) => b.is_current && b.name === target) ?? false;
      void run(`merge ${source} → ${target}`, async (g, p) => {
        if (!targetIsCurrent) await g.checkout(p, target);
        await g.merge(p, source, strategy);
      });
    },
    [run, snapshot],
  );

  const stage = useCallback(
    (file: string) => void run("stage", (g, p) => g.stage(p, file)),
    [run],
  );
  const unstage = useCallback(
    (file: string) => void run("unstage", (g, p) => g.unstage(p, file)),
    [run],
  );
  const stageAll = useCallback(() => void run("stage all", (g, p) => g.stageAll(p)), [run]);
  const unstageAll = useCallback(
    () => void run("unstage all", (g, p) => g.unstageAll(p)),
    [run],
  );

  const gitignore = useCallback(
    (file: string) => void run("add to .gitignore", (g, p) => g.addToGitignore(p, file)),
    [run],
  );

  const stashPop = useCallback(
    (s: Stash) => void run("stash pop", (g, p) => g.stashPop(p, s.reff)),
    [run],
  );
  const stashApply = useCallback(
    (s: Stash) => void run("stash apply", (g, p) => g.stashApply(p, s.reff)),
    [run],
  );
  const stashDrop = useCallback(
    (s: Stash) => void run("stash drop", (g, p) => g.stashDrop(p, s.reff)),
    [run],
  );

  const originRemote =
    snapshot?.remotes.find((r) => r.name === "origin") ?? snapshot?.remotes[0];
  const webUrl = originRemote ? remoteWebUrl(originRemote.url) : null;
  const hostLabel = (originRemote && remoteHostLabel(originRemote.url)) || "Web";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-[13px] text-foreground">
      <TitleBar
        repo={snapshot?.info ?? null}
        busy={busy}
        webUrl={webUrl}
        hostLabel={hostLabel}
        recentRepos={recent}
        onOpenRecent={(p) => void openRecent(p)}
        onRefresh={refresh}
        onOpen={chooseRepo}
        onClone={() => setCloneOpen(true)}
        onFetch={() => run("fetch", (g, p) => g.fetch(p))}
        onPull={() => run("pull", (g, p) => g.pull(p))}
        onPush={() => run("push", (g, p) => g.push(p))}
        onStash={() => run("stash", (g, p) => g.stashSave(p))}
        onOpenWebUrl={() => {
          if (webUrl) openUrl(webUrl).catch((e) => toast(`open link: ${String(e)}`));
        }}
      />

      {error && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-destructive">
          {error}
        </div>
      )}

      {snapshot ? (
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
                branches={snapshot.branches}
                status={snapshot.status}
                remotes={snapshot.remotes}
                tags={snapshot.tags}
                stashes={snapshot.stashes}
                remoteBranches={snapshot.remoteBranches}
                submodules={snapshot.submodules}
                onCheckoutBranch={checkoutBranch}
                onCreateBranch={createBranch}
                onDeleteBranch={deleteBranch}
                onMergeBranch={(source, target) => setMergeReq({ source, target })}
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
              <FileBrowser repoPath={snapshot.info.path} onGitignore={gitignore} />
            ) : view === "pulls" ? (
              <PullRequestsView
                repoPath={snapshot.info.path}
                busy={busy}
                onCheckout={(n) =>
                  void run(`checkout PR #${n}`, (g, p) => g.prCheckout(p, n))
                }
                onRepoChanged={() => run("fetch", (g, p) => g.fetch(p))}
              />
            ) : view === "changes" ? (
              <ChangesView
                repoPath={snapshot.info.path}
                status={snapshot.status}
                selected={selectedChange}
                onSelect={setSelectedChange}
                onStage={stage}
                onUnstage={unstage}
                onStageAll={stageAll}
                onUnstageAll={unstageAll}
                onCommit={session.commit}
                onGitignore={gitignore}
                busy={busy}
              />
            ) : (
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize="58%" minSize="20%">
                  <CommitList
                    commits={snapshot.commits}
                    selected={selectedHash}
                    onSelect={selectHash}
                    actions={commitActions}
                    busy={busy}
                  />
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel defaultSize="42%" minSize="15%">
                  {selectedHash ? (
                    <ResizablePanelGroup orientation="horizontal">
                      <ResizablePanel defaultSize="42%" minSize="20%">
                        <div className="h-full border-t border-border">
                          <CommitDetail
                            repoPath={snapshot.info.path}
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
                            repoPath={snapshot.info.path}
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
            void session.open(p);
          }}
        />
      )}

      {prompt && (
        <PromptDialog
          title={prompt.kind === "branch" ? "New branch at this commit" : "New tag at this commit"}
          placeholder={prompt.kind === "branch" ? "branch-name" : "tag-name"}
          onConfirm={(name) => {
            if (prompt.kind === "branch")
              void run(`branch ${name}`, (g, p) => g.createBranch(p, name, prompt.hash));
            else void run(`tag ${name}`, (g, p) => g.createTag(p, name, prompt.hash));
          }}
          onClose={() => setPrompt(null)}
        />
      )}

      {mergeReq && (
        <MergeDialog
          source={mergeReq.source}
          target={mergeReq.target}
          busy={busy}
          onConfirm={(strategy) => mergeBranches(mergeReq.source, mergeReq.target, strategy)}
          onClose={() => setMergeReq(null)}
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
