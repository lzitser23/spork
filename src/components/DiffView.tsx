import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { fileDiff, workingDiff } from "@/lib/git";
import { highlightLines, langForPath, type Token } from "@/lib/highlight";

/** What to diff: a file inside a commit, or a file in the working tree. */
export type DiffTarget =
  | { kind: "commit"; hash: string; file: string }
  | { kind: "working"; file: string };

/** A diff body line carries actual code (added/removed/context). */
function isCodeLine(line: string): boolean {
  return (
    (line.startsWith("+") && !line.startsWith("+++")) ||
    (line.startsWith("-") && !line.startsWith("---")) ||
    line.startsWith(" ")
  );
}

/** Styling for header/metadata lines (and the plain-text fallback). */
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

/** Background tint for a highlighted add/remove line. */
function lineBg(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "bg-emerald-500/10";
  if (line.startsWith("-") && !line.startsWith("---")) return "bg-red-500/10";
  return "";
}

/** Color for the leading +/- sign of a highlighted line. */
function signColor(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "text-emerald-400";
  if (line.startsWith("-") && !line.startsWith("---")) return "text-red-400";
  return "text-foreground/40";
}

export function DiffView({
  repoPath,
  target,
}: {
  repoPath: string;
  target: DiffTarget | null;
}) {
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-line syntax tokens, keyed by line index (code lines only).
  const [hl, setHl] = useState<Record<number, Token[]> | null>(null);

  const key = target
    ? target.kind === "commit"
      ? `commit:${target.hash}:${target.file}`
      : `working:${target.file}`
    : "";
  const targetFile = target?.file ?? null;

  useEffect(() => {
    if (!target) {
      setDiff("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const req =
      target.kind === "commit"
        ? fileDiff(repoPath, target.hash, target.file)
        : workingDiff(repoPath, target.file);
    req
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
    // `key` fully captures the target's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, key]);

  // Highlight the code lines of the diff (best-effort, syntax with diff context).
  useEffect(() => {
    setHl(null);
    if (!diff || !targetFile) return;
    const lang = langForPath(targetFile);
    if (!lang) return;
    const lines = diff.split("\n");
    const idx: number[] = [];
    const texts: string[] = [];
    lines.forEach((l, i) => {
      if (isCodeLine(l)) {
        idx.push(i);
        texts.push(l.slice(1));
      }
    });
    if (texts.length === 0) return;
    let cancelled = false;
    highlightLines(texts.join("\n"), lang).then((toks) => {
      if (cancelled || !toks || toks.length !== idx.length) return;
      const map: Record<number, Token[]> = {};
      idx.forEach((lineIndex, k) => {
        map[lineIndex] = toks[k];
      });
      setHl(map);
    });
    return () => {
      cancelled = true;
    };
  }, [diff, targetFile]);

  if (!target)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        select a file to view its diff
      </div>
    );
  if (loading)
    return <div className="p-3 text-muted-foreground/60">loading diff…</div>;
  if (error) return <div className="p-3 text-destructive">{error}</div>;
  if (!diff.trim())
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        no textual changes
      </div>
    );

  const lines = diff.split("\n");
  return (
    <div className="h-full overflow-auto py-1 text-[12px] leading-[1.5]">
      {lines.map((line, i) => {
        const toks = hl ? hl[i] : undefined;
        if (toks) {
          return (
            <div key={i} className={cn("whitespace-pre px-3", lineBg(line))}>
              <span className={signColor(line)}>{line[0] ?? " "}</span>
              {toks.map((t, j) => (
                <span key={j} style={{ color: t.color }}>
                  {t.content}
                </span>
              ))}
            </div>
          );
        }
        return (
          <div key={i} className={cn("whitespace-pre px-3", lineClass(line))}>
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}
