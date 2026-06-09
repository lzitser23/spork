import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { computeGraph } from "@/lib/graph";
import { GraphCell, ROW_H } from "@/components/CommitGraph";
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
  const [query, setQuery] = useState("");
  const graph = useMemo(() => computeGraph(commits), [commits]);

  const q = query.trim().toLowerCase();
  // Filtering hides commits, which would break the graph topology, so the lanes
  // are only drawn when showing the full, unfiltered list.
  const showGraph = q.length === 0;
  const filtered = q
    ? commits.filter(
        (c) =>
          c.subject.toLowerCase().includes(q) ||
          c.author_name.toLowerCase().includes(q) ||
          c.hash.toLowerCase().includes(q),
      )
    : commits;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-2.5 py-1 text-muted-foreground/60">
        <Search className="size-3 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter commits…"
          spellCheck={false}
          className="w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground/50">
            {commits.length === 0 ? "no commits yet" : "no matching commits"}
          </div>
        ) : (
          filtered.map((c, i) => (
            <button
              key={c.hash}
              onClick={() => onSelect(c.hash)}
              style={{ height: ROW_H }}
              className={cn(
                "flex w-full items-center gap-2 px-2 text-left",
                selected === c.hash ? "bg-muted" : "hover:bg-muted/40",
              )}
            >
              {showGraph ? (
                <GraphCell
                  node={graph.nodes[i]}
                  above={graph.bands[i - 1] ?? []}
                  below={graph.bands[i] ?? []}
                  width={graph.width}
                  selected={selected === c.hash}
                />
              ) : (
                <span className="flex w-[14px] shrink-0 justify-center">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                </span>
              )}
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
          ))
        )}
      </div>
    </div>
  );
}
