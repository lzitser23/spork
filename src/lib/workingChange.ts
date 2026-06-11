import { statusStyle } from "@/lib/format";
import type { StatusEntry } from "@/lib/git";

/**
 * Semantic reading of a porcelain `(x, y)` status pair. The raw pair stays
 * behind this interface — views consume areas, letters, and labels, never
 * `x`/`y` directly.
 */
export interface WorkingChange {
  entry: StatusEntry;
  path: string;
  /** In the index. A file can be staged *and* unstaged at once (e.g. "MM"). */
  staged: boolean;
  /** Has working-tree edits beyond the index (includes untracked). */
  unstaged: boolean;
  untracked: boolean;
  /** Unmerged after a conflict (UU, AA, DD, …). */
  conflicted: boolean;
  /** One-letter badge + color for a row in the staged list. */
  stagedStyle: { label: string; className: string };
  /** One-letter badge + color for a row in the unstaged list. */
  unstagedStyle: { label: string; className: string };
  /** Header label for the diff pane ("staged + unstaged", "untracked", …). */
  summary: { text: string; className: string };
}

export function classifyChange(entry: StatusEntry): WorkingChange {
  const { x, y } = entry;
  const untracked = x === "?";
  const conflicted =
    x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D");
  const staged = x !== " " && x !== "?";
  const unstaged = y !== " ";

  const summary = conflicted
    ? { text: "conflict", className: "text-red-400" }
    : untracked
      ? { text: "untracked", className: "text-amber-400" }
      : staged && unstaged
        ? { text: "staged + unstaged", className: "text-sky-400" }
        : staged
          ? { text: "staged", className: "text-sky-400" }
          : { text: "unstaged", className: "text-muted-foreground/70" };

  return {
    entry,
    path: entry.path,
    staged,
    unstaged,
    untracked,
    conflicted,
    stagedStyle: statusStyle(x),
    unstagedStyle: statusStyle(y),
    summary,
  };
}

export function classifyAll(status: StatusEntry[]): WorkingChange[] {
  return status.map(classifyChange);
}
