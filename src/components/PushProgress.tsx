import { DotmSquare3 } from "@/components/ui/dotm-square-3";

/**
 * Floating card showing a running push's git progress, terminal-style: the
 * latest stderr line verbatim, plus a thin bar when the line carries a
 * percentage ("Writing objects: 45% (9/20) …").
 */
export function PushProgress({ line }: { line: string }) {
  const pct = /(\d+)%/.exec(line)?.[1];
  return (
    <div className="fixed bottom-3 right-3 z-50 flex w-80 items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2 shadow-md">
      <DotmSquare3 size={14} dotSize={2} ariaLabel="Pushing" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] text-muted-foreground">{line}</div>
        {pct !== undefined && (
          <div className="mt-1.5 h-0.5 w-full rounded-full bg-border">
            <div
              className="h-full rounded-full bg-foreground/60 transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
