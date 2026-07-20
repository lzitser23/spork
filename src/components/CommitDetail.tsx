import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Loading } from "@/components/Loading";
import { fullDate, statusStyle } from "@/lib/format";
import type { CommitDetails, FileChange } from "@/lib/git";
import { useGit } from "@/lib/gitClient";

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="text-muted-foreground/50">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </>
  );
}

export function CommitDetail({
  repoPath,
  hash,
  selectedFile,
  onSelectFile,
}: {
  repoPath: string;
  hash: string;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}) {
  const git = useGit();
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [files, setFiles] = useState<FileChange[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setDetails(null);
    Promise.all([git.commitDetails(repoPath, hash), git.commitFiles(repoPath, hash)])
      .then(([d, f]) => {
        if (cancelled) return;
        setDetails(d);
        setFiles(f);
        if (f.length > 0 && !f.some((x) => x.path === selectedFile)) {
          onSelectFile(f[0].path);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
    // Re-run only when the commit changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [git, repoPath, hash]);

  if (error) return <div className="p-3 text-destructive">{error}</div>;
  if (!details) return <Loading />;

  return (
    <div className="flex h-full flex-col overflow-y-auto text-[12px]">
      <div className="space-y-1.5 border-b border-border/40 p-3">
        <div className="text-foreground">{details.subject}</div>
        {details.body && (
          <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground/80">
            {details.body}
          </pre>
        )}
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pt-1 text-[11px] text-muted-foreground">
          <Meta label="author">
            {details.author.name} &lt;{details.author.email}&gt; · {fullDate(details.author.timestamp)}
          </Meta>
          <Meta label="committer">
            {details.committer.name} · {fullDate(details.committer.timestamp)}
          </Meta>
          <Meta label="sha">
            <span className="break-all">{details.hash}</span>
          </Meta>
          <Meta label="parents">
            {details.parents.length > 0
              ? details.parents.map((p) => p.slice(0, 7)).join(", ")
              : "(root)"}
          </Meta>
        </div>
      </div>

      <div className="px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
        {files.length} file{files.length === 1 ? "" : "s"} changed
      </div>
      <div className="pb-2">
        {files.map((f) => {
          const st = statusStyle(f.status);
          return (
            <button
              key={f.path}
              onClick={() => onSelectFile(f.path)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1 text-left",
                selectedFile === f.path ? "bg-muted" : "hover:bg-muted/40",
              )}
            >
              <span className={cn("w-3 shrink-0 text-center", st.className)}>
                {st.label}
              </span>
              <span className="flex-1 truncate text-muted-foreground">{f.path}</span>
              {f.binary ? (
                <span className="shrink-0 text-muted-foreground/50">bin</span>
              ) : (
                <>
                  <span className="shrink-0 text-emerald-500">+{f.additions}</span>
                  <span className="shrink-0 text-red-500">-{f.deletions}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
