import { cn } from "@/lib/utils";
import { DiffView } from "@/components/DiffView";
import type { WorkingChange } from "@/lib/workingChange";

/** A working-tree change: file header + its diff against HEAD. */
export function ChangeView({
  repoPath,
  change,
}: {
  repoPath: string;
  change: WorkingChange;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5 text-[12px]">
        <span className="truncate text-foreground">{change.path}</span>
        <span className={cn("ml-auto shrink-0 text-[11px]", change.summary.className)}>
          {change.summary.text}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <DiffView repoPath={repoPath} target={{ kind: "working", file: change.path }} />
      </div>
    </div>
  );
}
