import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import type { Commit, RefBadge } from "@/lib/git";

const refClasses: Record<RefBadge["kind"], string> = {
  head: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  branch: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  remote: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  tag: "border-amber-500/40 bg-amber-500/10 text-amber-400",
};

function RefPill({ badge }: { badge: RefBadge }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded border px-1 text-[10px] leading-tight",
        refClasses[badge.kind],
      )}
    >
      {badge.name}
    </span>
  );
}

export function CommitList({
  commits,
  selected,
  onSelect,
}: {
  commits: Commit[];
  selected: string | null;
  onSelect: (hash: string) => void;
}) {
  if (commits.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/60">
        no commits yet
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto">
      {commits.map((c) => (
        <button
          key={c.hash}
          onClick={() => onSelect(c.hash)}
          className={cn(
            "flex w-full items-center gap-2 border-b border-border/30 px-3 py-1.5 text-left",
            selected === c.hash ? "bg-muted" : "hover:bg-muted/40",
          )}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
          {c.refs.map((r) => (
            <RefPill key={r.kind + r.name} badge={r} />
          ))}
          <span className="flex-1 truncate">{c.subject}</span>
          <span className="w-28 shrink-0 truncate text-right text-muted-foreground/80">
            {c.author_name}
          </span>
          <span className="w-16 shrink-0 text-right text-muted-foreground/60">
            {c.short_hash}
          </span>
          <span className="w-10 shrink-0 text-right text-muted-foreground/60">
            {relativeTime(c.timestamp)}
          </span>
        </button>
      ))}
    </div>
  );
}
