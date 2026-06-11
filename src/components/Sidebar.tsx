import { useState, type ReactNode } from "react";
import {
  Archive,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  FileDiff,
  FolderTree,
  GitBranch,
  GitPullRequest,
  History,
  Plus,
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Branch, Remote, Stash, StatusEntry } from "@/lib/git";

export type View = "history" | "files" | "changes" | "pulls";

const NAV: { key: View; label: string; icon: LucideIcon }[] = [
  { key: "history", label: "History", icon: History },
  { key: "files", label: "Files", icon: FolderTree },
  { key: "changes", label: "Changes", icon: FileDiff },
  { key: "pulls", label: "Pull Requests", icon: GitPullRequest },
];

function Section({
  title,
  count,
  defaultOpen = true,
  action,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="select-none">
      <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1 hover:text-muted-foreground"
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          <span>{title}</span>
        </button>
        {count !== undefined && <span className="tabular-nums">{count}</span>}
        {action}
      </div>
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

/** A trash button that flips to an inline ✓/✗ confirm. Always faintly visible. */
function RemoveBtn({
  busy,
  label,
  onConfirm,
}: {
  busy: boolean;
  label: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onConfirm();
            setConfirming(false);
          }}
          title={label}
          className="text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          <Check className="size-3" />
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
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => setConfirming(true)}
      title={label}
      aria-label={label}
      className="shrink-0 text-muted-foreground/40 opacity-60 hover:text-red-400 hover:opacity-100 disabled:opacity-50"
    >
      <Trash2 className="size-3" />
    </button>
  );
}

/** One ref row (branch or tag): checkout on click, delete via inline confirm. */
function RefRow({
  name,
  current,
  icon: Icon,
  busy,
  onCheckout,
  onDelete,
}: {
  name: string;
  current?: boolean;
  icon: LucideIcon;
  busy: boolean;
  onCheckout: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  return (
    <div
      className={cn(
        "mx-1 flex items-center gap-1 rounded-md px-2 py-1",
        current ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={current ? undefined : () => onCheckout(name)}
        disabled={!current && busy}
        title={current ? "current" : `Checkout ${name}`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 text-left",
          !current && !busy && "cursor-pointer",
        )}
      >
        {current ? (
          <Check className="size-3 shrink-0 text-emerald-500" />
        ) : (
          <Icon className="size-3 shrink-0" />
        )}
        <span className="truncate">{name}</span>
      </button>
      {!current && <RemoveBtn busy={busy} label={`Delete ${name}`} onConfirm={() => onDelete(name)} />}
    </div>
  );
}

/** Branches/Tags: list + checkout + delete, with a "+ new" inline input. */
function RefSection({
  title,
  items,
  icon,
  busy,
  defaultOpen = true,
  createPlaceholder,
  onCheckout,
  onCreate,
  onDelete,
}: {
  title: string;
  items: { name: string; current?: boolean }[];
  icon: LucideIcon;
  busy: boolean;
  defaultOpen?: boolean;
  createPlaceholder: string;
  onCheckout: (name: string) => void;
  onCreate: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
          <span>{title}</span>
        </button>
        <span className="tabular-nums">{items.length}</span>
        <button
          title={`New ${title.toLowerCase().replace(/s$/, "")}`}
          aria-label={`New ${title}`}
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
              <Plus className="size-3 shrink-0 text-muted-foreground/50" />
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
                placeholder={createPlaceholder}
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          )}
          {items.map((it) => (
            <RefRow
              key={it.name}
              name={it.name}
              current={it.current}
              icon={icon}
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

/** Remotes: list + remove, with an "+ add" inline name/url form. */
function RemotesSection({
  remotes,
  busy,
  onAdd,
  onRemove,
}: {
  remotes: Remote[];
  busy: boolean;
  onAdd: (name: string, url: string) => void;
  onRemove: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const reset = () => {
    setName("");
    setUrl("");
    setAdding(false);
  };
  const submit = () => {
    const n = name.trim();
    const u = url.trim();
    reset();
    if (n && u) onAdd(n, u);
  };

  return (
    <div className="select-none">
      <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1 hover:text-muted-foreground"
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          <span>Remotes</span>
        </button>
        <span className="tabular-nums">{remotes.length}</span>
        <button
          title="Add remote"
          aria-label="Add remote"
          disabled={busy}
          onClick={() => {
            setOpen(true);
            setAdding(true);
          }}
          className="rounded p-0.5 hover:text-foreground disabled:opacity-50"
        >
          <Plus className="size-3" />
        </button>
      </div>
      {open && (
        <div className="pb-1">
          {adding && (
            <div className="mx-1 mb-1 flex flex-col gap-1 rounded-md border border-border/60 px-2 py-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") reset();
                }}
                placeholder="name (e.g. origin)"
                spellCheck={false}
                className="w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") reset();
                }}
                placeholder="https://… or git@… (Enter to add)"
                spellCheck={false}
                className="w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          )}
          {remotes.map((r) => (
            <div
              key={r.name}
              title={r.url}
              className="mx-1 flex items-center gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/50"
            >
              <Cloud className="size-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <RemoveBtn busy={busy} label={`Remove ${r.name}`} onConfirm={() => onRemove(r.name)} />
            </div>
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
  submodules,
  onCheckoutBranch,
  onCreateBranch,
  onDeleteBranch,
  onCheckoutRemote,
  onCreateTag,
  onDeleteTag,
  onCheckoutTag,
  onAddRemote,
  onRemoveRemote,
  onSubmoduleUpdate,
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
  submodules: string[];
  onCheckoutBranch: (name: string) => void;
  onCreateBranch: (name: string) => void;
  onDeleteBranch: (name: string) => void;
  onCheckoutRemote: (remoteRef: string) => void;
  onCreateTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onCheckoutTag: (name: string) => void;
  onAddRemote: (name: string, url: string) => void;
  onRemoveRemote: (name: string) => void;
  onSubmoduleUpdate: () => void;
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

      <RefSection
        title="Branches"
        icon={GitBranch}
        busy={busy}
        createPlaceholder="new-branch-name"
        items={branches.map((b) => ({ name: b.name, current: b.is_current }))}
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

      <RefSection
        title="Tags"
        icon={Tag}
        busy={busy}
        defaultOpen={false}
        createPlaceholder="new-tag-name"
        items={tags.map((t) => ({ name: t }))}
        onCheckout={onCheckoutTag}
        onCreate={onCreateTag}
        onDelete={onDeleteTag}
      />

      <RemotesSection
        remotes={remotes}
        busy={busy}
        onAdd={onAddRemote}
        onRemove={onRemoveRemote}
      />

      {submodules.length > 0 && (
        <Section
          title="Submodules"
          count={submodules.length}
          defaultOpen={false}
          action={
            <button
              title="Update submodules (init & update --recursive)"
              disabled={busy}
              onClick={onSubmoduleUpdate}
              className="rounded px-1 text-[10px] normal-case tracking-normal text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              update
            </button>
          }
        >
          {submodules.map((s) => (
            <Row key={s} icon={<Box className="size-3 shrink-0" />}>
              {s}
            </Row>
          ))}
        </Section>
      )}

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
