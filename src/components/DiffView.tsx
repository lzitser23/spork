import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { Loading } from "@/components/Loading";
import type { ImageContent } from "@/lib/git";
import { useGit } from "@/lib/gitClient";
import { highlightLines, langForPath, type Token } from "@/lib/highlight";
import { CHECKER, formatBytes, isImagePath } from "@/lib/images";

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

/** Height of one diff row in px — must match the `text-[12px] leading-[1.5]`
 *  (12 × 1.5) container below; the virtualizer positions rows on this grid. */
const DIFF_ROW_H = 18;
/** Above this many lines, render only the visible window instead of a DOM node
 *  per line — otherwise a 50k-line diff mounts 50k <div>s and freezes the pane. */
const VIRTUAL_THRESHOLD = 800;
/** Rows kept mounted just outside the viewport, so fast scrolling stays smooth. */
const OVERSCAN = 24;

/** One unified-diff line: syntax-highlighted tokens when available, else plain
 *  text with per-line tint. `style` carries the absolute position when windowed. */
function diffLine(
  line: string,
  i: number,
  toks: Token[] | undefined,
  style?: CSSProperties,
) {
  if (toks) {
    return (
      <div key={i} className={cn("whitespace-pre px-3", lineBg(line))} style={style}>
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
    <div key={i} className={cn("whitespace-pre px-3", lineClass(line))} style={style}>
      {line || " "}
    </div>
  );
}

/**
 * Render unified-diff text with per-line styling and best-effort syntax
 * highlighting (`file` picks the language). The fetch-free half of DiffView,
 * for callers that already hold the diff (e.g. the pull-request view).
 */
export function DiffText({ diff, file }: { diff: string; file: string | null }) {
  // Per-line syntax tokens, keyed by line index (code lines only).
  const [hl, setHl] = useState<Record<number, Token[]> | null>(null);
  const lines = useMemo(() => diff.split("\n"), [diff]);
  // Longest line, for a stable horizontal-scroll extent in the windowed path:
  // absolutely-positioned rows don't contribute to scrollWidth, so without this
  // the scrollbar would jump as wide lines scroll in and out of the window.
  const maxLen = useMemo(() => lines.reduce((m, l) => (l.length > m ? l.length : m), 0), [lines]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  // Measure the scroller's height for the window. Re-runs on `diff` because the
  // ref only attaches on the large-diff branch, so switching a small diff to a
  // large one in the same instance must (re)attach and measure; ResizeObserver
  // also keeps it right as the surrounding panes are dragged. (jsdom stubs
  // ResizeObserver to a no-op; the >800-line path never runs there anyway.)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setViewport(el.clientHeight);
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [diff]);
  // A new diff starts at the top (a leftover scroll offset would show a blank gap).
  useEffect(() => {
    setScrollTop(0);
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [diff]);

  // Highlight the code lines of the diff (best-effort, syntax with diff context).
  useEffect(() => {
    setHl(null);
    if (!diff || !file) return;
    const lang = langForPath(file);
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
  }, [diff, file]);

  if (!diff.trim())
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        no textual changes
      </div>
    );

  // Small diffs: plain flow layout — cheap, and byte-for-byte the old behavior.
  if (lines.length <= VIRTUAL_THRESHOLD) {
    return (
      <div className="h-full overflow-auto py-1 text-[12px] leading-[1.5]">
        {lines.map((line, i) => diffLine(line, i, hl?.[i]))}
      </div>
    );
  }

  // Large diffs: render only the rows in (and near) the viewport, absolutely
  // positioned inside a full-height spacer so the scrollbar still spans it all.
  const first = Math.max(0, Math.floor(scrollTop / DIFF_ROW_H) - OVERSCAN);
  const last = Math.min(
    lines.length,
    Math.ceil((scrollTop + (viewport || 600)) / DIFF_ROW_H) + OVERSCAN,
  );
  const rows = [];
  for (let i = first; i < last; i++) {
    rows.push(
      diffLine(lines[i], i, hl?.[i], {
        position: "absolute",
        top: i * DIFF_ROW_H,
        left: 0,
        height: DIFF_ROW_H,
      }),
    );
  }
  return (
    <div
      ref={scrollerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="h-full overflow-auto py-1 text-[12px] leading-[1.5]"
    >
      <div
        style={{
          position: "relative",
          height: lines.length * DIFF_ROW_H,
          // `ch` is the monospace glyph width, so this spans the longest line
          // (+ the rows' px-3 padding); keeps the scrollbar extent fixed.
          minWidth: `calc(${maxLen}ch + 1.5rem)`,
        }}
      >
        {rows}
      </div>
    </div>
  );
}

/** One side of an image diff: a captioned image on the checkerboard backing. */
function ImageCell({
  label,
  image,
  file,
}: {
  label: string;
  image: ImageContent;
  file: string;
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
        {label}
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
        style={CHECKER}
      >
        {image.too_large ? (
          <span className="text-muted-foreground/50">image too large to preview</span>
        ) : (
          <img
            src={`data:${image.mime};base64,${image.data}`}
            alt={file}
            onLoad={(e) =>
              setDims({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
      <div className="shrink-0 border-t border-border/40 px-3 py-1 text-[11px] text-muted-foreground/60">
        {dims ? `${dims.w}×${dims.h} · ` : ""}
        {formatBytes(image.size)}
      </div>
    </div>
  );
}

/**
 * An image file's diff: before (parent / HEAD) and after (commit / working
 * tree) side by side. A missing side means the file was added or deleted, in
 * which case the single present side is labeled accordingly.
 */
function ImageDiffView({
  repoPath,
  target,
}: {
  repoPath: string;
  target: DiffTarget;
}) {
  const git = useGit();
  const [before, setBefore] = useState<ImageContent | null>(null);
  const [after, setAfter] = useState<ImageContent | null>(null);
  const [loading, setLoading] = useState(true);

  // A staged rename appears as "old -> new"; the working file is the new path.
  const file = target.file.split(" -> ").pop() ?? target.file;
  const key =
    target.kind === "commit"
      ? `commit:${target.hash}:${file}`
      : `working:${file}`;

  useEffect(() => {
    let cancelled = false;
    setBefore(null);
    setAfter(null);
    setLoading(true);

    // Either side may be absent (add/delete) — a failed read resolves to null.
    const miss = () => null as ImageContent | null;
    const [beforeReq, afterReq] =
      target.kind === "commit"
        ? [
            git.readImageAt(repoPath, `${target.hash}^`, file).catch(miss),
            git.readImageAt(repoPath, target.hash, file).catch(miss),
          ]
        : [
            git.readImageAt(repoPath, "HEAD", file).catch(miss),
            git.readImage(repoPath, file).catch(miss),
          ];

    Promise.all([beforeReq, afterReq]).then(([b, a]) => {
      if (cancelled) return;
      setBefore(b);
      setAfter(a);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // `key` fully captures the target's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [git, repoPath, key]);

  if (loading) return <Loading label="loading image…" />;
  if (!before && !after)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        could not load image
      </div>
    );

  return (
    <div className="flex h-full divide-x divide-border/40">
      {before && (
        <ImageCell label={after ? "before" : "deleted"} image={before} file={file} />
      )}
      {after && (
        <ImageCell label={before ? "after" : "added"} image={after} file={file} />
      )}
    </div>
  );
}

export function DiffView({
  repoPath,
  target,
}: {
  repoPath: string;
  target: DiffTarget | null;
}) {
  // Images get a visual before/after preview; everything else, a textual diff.
  if (target && isImagePath(target.file)) {
    return <ImageDiffView repoPath={repoPath} target={target} />;
  }
  return <TextDiffView repoPath={repoPath} target={target} />;
}

function TextDiffView({
  repoPath,
  target,
}: {
  repoPath: string;
  target: DiffTarget | null;
}) {
  const git = useGit();
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        ? git.fileDiff(repoPath, target.hash, target.file)
        : git.workingDiff(repoPath, target.file);
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
  }, [git, repoPath, key]);

  if (!target)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        select a file to view its diff
      </div>
    );
  if (loading) return <Loading label="loading diff…" />;
  if (error) return <div className="p-3 text-destructive">{error}</div>;

  return <DiffText diff={diff} file={targetFile} />;
}
