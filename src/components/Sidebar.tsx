import { useState, type ReactNode } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  FileDiff,
  FolderTree,
  GitBranch,
  History,
  Plus,
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Branch, Remote, Stash, StatusEntry } from "@/lib/git";

export type View = "history" | "files" | "changes";

const NAV: { key: View; label: string; icon: LucideIcon }[] = [
  { key: "history", label: "History", icon: History },
  { key: "files", label: "Files", icon: FolderTree },
  { key: "changes", label: "Changes", icon: FileDiff },
];

function Section({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="select-none">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60 hover:text-muted-foreground"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span>{title}</span>
        {count !== undefined && <span className="ml-auto tabular-nums">{count}</span>}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function Row({
  icon,
  children,
  active,
  muted,
  onClick,
  disabled,
  title,
}: {
  icon?: ReactNode;
  children: ReactNode;
  active?: boolean;
  muted?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const className = cn(
    "mx-1 flex items-center gap-2 rounded-md px-2 py-1 text-left",
    active
      ? "bg-muted text-foreground"
      : muted
        ? "text-muted-foreground/70"
        : "text-muted-foreground",
    onClick && !disabled && !active && "hover:bg-muted/50",
    onClick && !disabled && "cursor-pointer",
    disabled && "opacity-50",
  );
  const content = (
    <>
      {icon}
      <span className="truncate">{children}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} title={title} className={className}>
        {content}
      </button>
    );
  }
  return (
    <div className={className} title={title}>
      {content}
    </div>
  );
}

/** One local branch row: checkout on click, with an inline-confirmed delete. */
function BranchRow({
  branch,
  busy,
  onCheckout,
  onDelete,
}: {
  branch: Branch;
  busy: boolean;
  onCheckout: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const b = branch;
  return (
    <div
      className={cn(
        "group/br mx-1 flex items-center gap-1 rounded-md px-2 py-1",
        b.is_current ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={b.is_current ? undefined : () => onCheckout(b.name)}
        disabled={!b.is_current && busy}
        title={b.is_current ? "current branch" : `Checkout ${b.name}`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 text-left",
          !b.is_current && !busy && "cursor-pointer",
        )}
      >
        {b.is_current ? (
          <Check className="size-3 shrink-0 text-emerald-500" />
        ) : (
          <GitBranch className="size-3 shrink-0" />
        )}
        <span className="truncate">{b.name}</span>
      </button>

      {!b.is_current &&
        (confirming ? (
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={busy}
              title={`Delete ${b.name}`}
              aria-label={`Confirm delete ${b.name}`}
              onClick={() => {
                onDelete(b.name);
                setConfirming(false);
              }}
              className="text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              <Check className="size-3" />
            </button>
            <button
              type="button"
              title="Cancel"
              aria-label="Cancel delete"
              onClick={() => setConfirming(false)}
              className="text-muted-foreground/60 hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            title={`Delete ${b.name}`}
            aria-label={`Delete ${b.name}`}
            onClick={() => setConfirming(true)}
            className="shrink-0 text-muted-foreground/50 opacity-0 hover:text-red-400 focus:opacity-100 group-hover/br:opacity-100 disabled:opacity-50"
          >
            <Trash2 className="size-3" />
          </button>
        ))}
    </div>
  );
}

/** Local branches: list + checkout + delete, with a "+ New branch" inline input. */
function BranchesSection({
  branches,
  busy,
  onCheckout,
  onCreate,
  onDelete,
}: {
  branches: Branch[];
  busy: boolean;
  onCheckout: (name: string) => void;
  onCreate: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    const n = name.trim();
    setName("");
    setCreating(false);
    if (n) onCreate(n);
  };

  return (
    <div className="select-none">
      <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1 hover:text-muted-foreground"
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          <span>Branches</span>
        </button>
        <span className="tabular-nums">{branches.length}</span>
        <button
          title="New branch"
          aria-label="New branch"
          disabled={busy}
          onClick={() => {
            setOpen(true);
            setCreating(true);
          }}
          className="rounded p-0.5 hover:text-foreground disabled:opacity-50"
        >
          <Plus className="size-3" />
        </button>
      </div>
      {open && (
        <div className="pb-1">
          {creating && (
            <div className="mx-1 mb-0.5 flex items-center gap-2 rounded-md px-2 py-1">
              <GitBranch className="size-3 shrink-0 text-muted-foreground/50" />
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") {
                    setName("");
                    setCreating(false);
                  }
                }}
                onBlur={() => {
                  if (!name.trim()) setCreating(false);
                }}
                placeholder="new-branch-name"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          )}
          {branches.map((b) => (
            <BranchRow
              key={b.name}
              branch={b}
              busy={busy}
              onCheckout={onCheckout}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** One stash row: pop / apply / drop on hover, with an inline-confirmed drop. */
function StashRow({
  stash,
  busy,
  onPop,
  onApply,
  onDrop,
}: {
  stash: Stash;
  busy: boolean;
  onPop: (s: Stash) => void;
  onApply: (s: Stash) => void;
  onDrop: (s: Stash) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="group/st mx-1 flex items-center gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/50">
      <Archive className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{stash.message}</span>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1.5 text-[10px]">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onDrop(stash);
              setConfirming(false);
            }}
            className="text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            drop?
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            aria-label="Cancel"
            className="text-muted-foreground/60 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] opacity-0 group-hover/st:opacity-100">
          <button
            type="button"
            disabled={busy}
            onClick={() => onPop(stash)}
            title="Pop (apply & remove)"
            className="hover:text-foreground disabled:opacity-50"
          >
            pop
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onApply(stash)}
            title="Apply (keep)"
            className="hover:text-foreground disabled:opacity-50"
          >
            apply
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            title="Drop (delete)"
            className="hover:text-red-400 disabled:opacity-50"
          >
            drop
          </button>
        </span>
      )}
    </div>
  );
}

export function Sidebar({
  view,
  onViewChange,
  branches,
  status,
  remotes,
  tags,
  stashes,
  remoteBranches,
  onCheckoutBranch,
  onCreateBranch,
  onDeleteBranch,
  onCheckoutRemote,
  onStashPop,
  onStashApply,
  onStashDrop,
  busy,
}: {
  view: View;
  onViewChange: (v: View) => void;
  branches: Branch[];
  status: StatusEntry[];
  remotes: Remote[];
  tags: string[];
  stashes: Stash[];
  remoteBranches: string[];
  onCheckoutBranch: (name: string) => void;
  onCreateBranch: (name: string) => void;
  onDeleteBranch: (name: string) => void;
  onCheckoutRemote: (remoteRef: string) => void;
  onStashPop: (stash: Stash) => void;
  onStashApply: (stash: Stash) => void;
  onStashDrop: (stash: Stash) => void;
  busy: boolean;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto py-1 text-[12px]">
      {/* Primary view switcher — a distinct header zone */}
      <div className="mb-1 border-b border-border px-1 pb-1.5 pt-0.5">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5",
              view === key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span>{label}</span>
            {key === "changes" && status.length > 0 && (
              <span className="ml-auto tabular-nums text-[11px] text-muted-foreground/70">
                {status.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <BranchesSection
        branches={branches}
        busy={busy}
        onCheckout={onCheckoutBranch}
        onCreate={onCreateBranch}
        onDelete={onDeleteBranch}
      />

      <Section title="Remote branches" count={remoteBranches.length} defaultOpen={false}>
        {remoteBranches.map((rb) => (
          <Row
            key={rb}
            onClick={() => onCheckoutRemote(rb)}
            disabled={busy}
            title={`Checkout ${rb}`}
            icon={<GitBranch className="size-3 shrink-0" />}
          >
            {rb}
          </Row>
        ))}
      </Section>

      <Section title="Remotes" count={remotes.length} defaultOpen={false}>
        {remotes.map((r) => (
          <Row key={r.name} icon={<Cloud className="size-3 shrink-0" />}>
            {r.name}
          </Row>
        ))}
      </Section>

      <Section title="Tags" count={tags.length} defaultOpen={false}>
        {tags.map((t) => (
          <Row key={t} icon={<Tag className="size-3 shrink-0" />}>
            {t}
          </Row>
        ))}
      </Section>

      <Section title="Stashes" count={stashes.length} defaultOpen={false}>
        {stashes.map((s) => (
          <StashRow
            key={s.reff}
            stash={s}
            busy={busy}
            onPop={onStashPop}
            onApply={onStashApply}
            onDrop={onStashDrop}
          />
        ))}
      </Section>
    </div>
  );
}
