import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderInput, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DotmSquare3 } from "@/components/ui/dotm-square-3";
import { useGit } from "@/lib/gitClient";

const inputClass =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring";

export function CloneDialog({
  onClose,
  onCloned,
}: {
  onClose: () => void;
  onCloned: (path: string) => void;
}) {
  const git = useGit();
  const [url, setUrl] = useState("");
  const [dir, setDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickDir = async () => {
    const d = await open({
      directory: true,
      multiple: false,
      title: "Choose a parent folder",
    });
    if (typeof d === "string") setDir(d);
  };

  const doClone = async () => {
    if (!url.trim() || !dir) return;
    setBusy(true);
    setError(null);
    try {
      const path = await git.clone(url.trim(), dir);
      onCloned(path);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-[92vw] rounded-lg border border-border bg-card p-4 text-[13px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">Clone a repository</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground/60">
          Repository URL
        </label>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void doClone()}
          placeholder="https://github.com/owner/repo.git"
          className={`mb-3 ${inputClass}`}
        />

        <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground/60">
          Destination (parent folder)
        </label>
        <div className="mb-3 flex gap-2">
          <input
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            placeholder="choose a folder…"
            className={inputClass}
          />
          <Button size="sm" variant="outline" onClick={pickDir} disabled={busy}>
            <FolderInput /> Browse
          </Button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={doClone}
            disabled={busy || !url.trim() || !dir}
          >
            {busy ? (
              <>
                <DotmSquare3 size={12} dotSize={2} ariaLabel="Cloning" /> Cloning…
              </>
            ) : (
              "Clone"
            )}
          </Button>
        </div>

        {busy && (
          <div className="mt-2 text-[11px] text-muted-foreground/70">
            If the repo is private, a sign-in window may pop up (GitHub, GitLab, Bitbucket, …) — complete it to continue.
          </div>
        )}
      </div>
    </div>
  );
}
