import { useEffect, useState } from "react";

import { readFile, type FileContent } from "@/lib/git";

export function FileView({
  repoPath,
  file,
}: {
  repoPath: string;
  file: string | null;
}) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setContent(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setContent(null);
    readFile(repoPath, file)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, file]);

  if (!file)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        select a file to view its code
      </div>
    );
  if (error) return <div className="p-3 text-destructive">{error}</div>;
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
              {l || " "}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
