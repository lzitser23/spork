import { cn } from "@/lib/utils";
import { DiffView } from "@/components/DiffView";
import type { StatusEntry } from "@/lib/git";

/** Human label for a porcelain status pair (x = staged, y = working tree). */
function workingLabel(x: string, y: string): { text: string; className: string } {
  if (x === "?") return { text: "untracked", className: "text-amber-400" };
  if (x !== " " && y !== " ")
    return { text: "staged + unstaged", className: "text-sky-400" };
  if (x !== " ") return { text: "staged", className: "text-sky-400" };
  return { text: "unstaged", className: "text-muted-foreground/70" };
}

/** A working-tree change: file header + its diff against HEAD. */
export function ChangeView({
  repoPath,
  change,
}: {
  repoPath: string;
  change: StatusEntry;
}) {
  const label = workingLabel(change.x, change.y);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5 text-[12px]">
        <span className="truncate text-foreground">{change.path}</span>
        <span className={cn("ml-auto shrink-0 text-[11px]", label.className)}>
          {label.text}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <DiffView repoPath={repoPath} target={{ kind: "working", file: change.path }} />
      </div>
    </div>
  );
}
