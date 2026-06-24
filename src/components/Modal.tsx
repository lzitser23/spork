import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { BranchMergeStrategy } from "@/lib/git";

/** A centered card over a dimmed backdrop. Escape or a backdrop click closes. */
export function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-background p-4 text-[12px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** A single text-input dialog (used for "branch here" / "tag here"). */
export function PromptDialog({
  title,
  placeholder,
  confirmLabel = "Create",
  onConfirm,
  onClose,
}: {
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onConfirm(v);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="mb-3 text-[13px] font-medium text-foreground">{title}</div>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-muted-foreground/40"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="outline" disabled={!value.trim()} onClick={submit}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

const STRATEGIES: { key: BranchMergeStrategy; label: string; hint: string }[] = [
  { key: "merge", label: "Merge", hint: "fast-forward when possible, else a merge commit" },
  { key: "no-ff", label: "Create a merge commit", hint: "always record a merge commit (--no-ff)" },
  { key: "squash", label: "Squash and merge", hint: "collapse the source's commits into one" },
  { key: "ff-only", label: "Fast-forward only", hint: "refuse if a merge commit would be needed" },
  { key: "rebase", label: "Rebase", hint: "replay the target's commits on top of the source" },
];

/** Pick a strategy for merging one local branch into another. */
export function MergeDialog({
  source,
  target,
  busy,
  onConfirm,
  onClose,
}: {
  source: string;
  target: string;
  busy: boolean;
  onConfirm: (strategy: BranchMergeStrategy) => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="text-[13px] font-medium text-foreground">Merge branch</div>
      <div className="mt-1 text-[12px] text-muted-foreground">
        Merge <span className="text-sky-400">{source}</span> into{" "}
        <span className="text-emerald-400">{target}</span>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {STRATEGIES.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={busy}
            onClick={() => {
              onConfirm(s.key);
              onClose();
            }}
            className="flex flex-col items-start rounded-md border border-border/60 px-2.5 py-1.5 text-left hover:border-muted-foreground/40 hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="text-[12px] text-foreground">{s.label}</span>
            <span className="text-[11px] text-muted-foreground/70">{s.hint}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
