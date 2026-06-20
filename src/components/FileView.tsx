import { useEffect, useState } from "react";

import type { FileContent, ImageContent } from "@/lib/git";
import { useGit } from "@/lib/gitClient";
import { highlightLines, langForPath, type Token } from "@/lib/highlight";
import { CHECKER, formatBytes, isImagePath } from "@/lib/images";

export function FileView({
  repoPath,
  file,
}: {
  repoPath: string;
  file: string | null;
}) {
  const git = useGit();
  const isImage = file ? isImagePath(file) : false;
  const [content, setContent] = useState<FileContent | null>(null);
  const [image, setImage] = useState<ImageContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[][] | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  // Load text content or image bytes depending on the file type.
  useEffect(() => {
    setContent(null);
    setImage(null);
    setError(null);
    setDims(null);
    if (!file) return;
    let cancelled = false;
    const req = isImage ? git.readImage(repoPath, file) : git.readFile(repoPath, file);
    req
      .then((r) => {
        if (cancelled) return;
        if (isImage) setImage(r as ImageContent);
        else setContent(r as FileContent);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [git, repoPath, file, isImage]);

  // Highlight text asynchronously once loaded; plain text shows until tokens arrive.
  useEffect(() => {
    setTokens(null);
    if (!file || !content || content.binary || content.too_large) return;
    const lang = langForPath(file);
    if (!lang) return;
    let cancelled = false;
    highlightLines(content.text.replace(/\n$/, ""), lang).then((t) => {
      if (!cancelled) setTokens(t);
    });
    return () => {
      cancelled = true;
    };
  }, [content, file]);

  if (!file)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        select a file to view its code
      </div>
    );
  if (error) return <div className="p-3 text-destructive">{error}</div>;

  if (isImage) {
    if (!image) return <div className="p-3 text-muted-foreground/60">loading…</div>;
    if (image.too_large)
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground/50">
          image too large to preview
        </div>
      );
    return (
      <div className="flex h-full flex-col">
        <div
          className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
          style={CHECKER}
        >
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
        </div>
        <div className="shrink-0 border-t border-border/40 px-3 py-1 text-[11px] text-muted-foreground/60">
          {file.split("/").pop()}
          {dims ? ` · ${dims.w}×${dims.h}` : ""} · {formatBytes(image.size)}
        </div>
      </div>
    );
  }

  if (!content) return <div className="p-3 text-muted-foreground/60">loading…</div>;
  if (content.binary)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        binary file — no preview
      </div>
    );
  if (content.too_large)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        file too large to preview
      </div>
    );

  const lines = content.text.replace(/\n$/, "").split("\n");
  const hl = tokens && tokens.length === lines.length ? tokens : null;

  return (
    <div className="h-full overflow-auto text-[12px] leading-[1.5]">
      <div className="flex min-w-max">
        <div className="sticky left-0 z-10 select-none bg-background px-3 text-right text-muted-foreground/40">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div className="pr-4">
          {lines.map((l, i) => (
            <div key={i} className="whitespace-pre">
              {hl ? (
                hl[i].length ? (
                  hl[i].map((t, j) => (
                    <span key={j} style={{ color: t.color }}>
                      {t.content}
                    </span>
                  ))
                ) : (
                  " "
                )
              ) : (
                l || " "
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
