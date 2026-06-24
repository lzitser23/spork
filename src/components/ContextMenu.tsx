import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  EyeOff,
  GitBranch,
  GitCommitHorizontal,
  GitGraph,
  Hash,
  RotateCcw,
  Tag,
  Type,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Commit, ResetMode } from "@/lib/git";

/** A lightweight right-click menu pinned at (x, y). Closes on any click,
 *  Escape, or scroll/resize. */
export function ContextMenu({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-background p-1 text-[12px] shadow-lg"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

export function ContextMenuItem({
  onClick,
  icon,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0",
        danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** A thin divider between groups of context-menu items. */
export function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

/** Commit actions wired by the app (each runs through the repo session). */
export interface CommitActions {
  onCheckout: (hash: string) => void;
  onCreateBranch: (hash: string) => void;
  onCherryPick: (hash: string) => void;
  onRevert: (hash: string) => void;
  onReset: (hash: string, mode: ResetMode) => void;
  onTag: (hash: string) => void;
}

/** The right-click menu for a commit row in the history list. */
export function CommitContextMenu({
  commit,
  x,
  y,
  actions,
  busy,
  onClose,
}: {
  commit: Commit;
  x: number;
  y: number;
  actions: CommitActions;
  busy: boolean;
  onClose: () => void;
}) {
  // The hard reset discards uncommitted work, so it's gated behind a one-click
  // confirm that swaps in place (the menu stays open — clicks inside it don't
  // bubble to the window-level close handler).
  const [confirmHard, setConfirmHard] = useState(false);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => toast(`copied ${what}`),
      () => toast(`couldn't copy ${what}`),
    );
    onClose();
  };

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <ContextMenuItem
        icon={<GitBranch />}
        disabled={busy}
        onClick={act(() => actions.onCreateBranch(commit.hash))}
      >
        Branch here…
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Tag />}
        disabled={busy}
        onClick={act(() => actions.onTag(commit.hash))}
      >
        Tag here…
      </ContextMenuItem>
      <ContextMenuItem
        icon={<GitCommitHorizontal />}
        disabled={busy}
        onClick={act(() => actions.onCheckout(commit.hash))}
      >
        Checkout (detached)
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        icon={<GitGraph />}
        disabled={busy}
        onClick={act(() => actions.onCherryPick(commit.hash))}
      >
        Cherry-pick onto current
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Undo2 />}
        disabled={busy}
        onClick={act(() => actions.onRevert(commit.hash))}
      >
        Revert commit
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        icon={<RotateCcw />}
        disabled={busy}
        onClick={act(() => actions.onReset(commit.hash, "soft"))}
      >
        Reset (soft) — keep staged
      </ContextMenuItem>
      <ContextMenuItem
        icon={<RotateCcw />}
        disabled={busy}
        onClick={act(() => actions.onReset(commit.hash, "mixed"))}
      >
        Reset (mixed) — keep changes
      </ContextMenuItem>
      {confirmHard ? (
        <ContextMenuItem
          icon={<AlertTriangle />}
          danger
          disabled={busy}
          onClick={act(() => actions.onReset(commit.hash, "hard"))}
        >
          Discard all & reset (hard)?
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          icon={<RotateCcw />}
          disabled={busy}
          onClick={() => setConfirmHard(true)}
        >
          Reset (hard) — discard changes…
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem icon={<Hash />} onClick={() => copy(commit.hash, "SHA")}>
        Copy SHA
      </ContextMenuItem>
      <ContextMenuItem icon={<Type />} onClick={() => copy(commit.subject, "message")}>
        Copy message
      </ContextMenuItem>
    </ContextMenu>
  );
}

/** The context menu for a file row (in the Files tree or the Changes list). */
export function FileContextMenu({
  file,
  x,
  y,
  onGitignore,
  onClose,
}: {
  file: string;
  x: number;
  y: number;
  onGitignore: (file: string) => void;
  onClose: () => void;
}) {
  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <ContextMenuItem
        icon={<EyeOff className="size-3.5 shrink-0" />}
        onClick={() => {
          onGitignore(file);
          onClose();
        }}
      >
        Add to .gitignore
      </ContextMenuItem>
    </ContextMenu>
  );
}
