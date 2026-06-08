import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { fileDiff } from "@/lib/git";

function lineClass(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++"))
    return "bg-emerald-500/10 text-emerald-300";
  if (line.startsWith("-") && !line.startsWith("---"))
    return "bg-red-500/10 text-red-300";
  if (line.startsWith("@@")) return "bg-sky-500/5 text-sky-400";
  if (
    line.startsWith("diff ") ||
    line.startsWith("index ") ||
    line.startsWith("+++") ||
    line.startsWith("---") ||
    line.startsWith("new file") ||
    line.startsWith("deleted file") ||
    line.startsWith("similarity") ||
    line.startsWith("rename ")
  )
    return "text-muted-foreground/50";
  return "text-foreground/80";
}

export function DiffView({
  repoPath,
  hash,
  file,
}: {
  repoPath: string;
  hash: string;
  file: string | null;
}) {
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setDiff("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fileDiff(repoPath, hash, file)
      .then((d) => {
        if (!cancelled) setDiff(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, hash, file]);

  if (!file)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        select a file to view its diff
      </div>
    );
  if (loading)
    return <div className="p-3 text-muted-foreground/60">loading diff…</div>;
  if (error) return <div className="p-3 text-destructive">{error}</div>;

  const lines = diff.split("\n");
  return (
    <div className="h-full overflow-auto py-1 text-[12px] leading-[1.5]">
      {lines.map((line, i) => (
        <div key={i} className={cn("whitespace-pre px-3", lineClass(line))}>
          {line || " "}
        </div>
      ))}
    </div>
  );
}
