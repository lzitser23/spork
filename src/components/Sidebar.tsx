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
  Tag,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Branch, Remote, Stash, StatusEntry } from "@/lib/git";

export type View = "history" | "files";

const NAV: { key: View; label: string; icon: LucideIcon }[] = [
  { key: "history", label: "History", icon: History },
  { key: "files", label: "Files", icon: FolderTree },
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
}: {
  icon?: ReactNode;
  children: ReactNode;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-1 flex items-center gap-2 rounded-md px-2 py-1",
        active
          ? "bg-muted text-foreground"
          : muted
            ? "text-muted-foreground/70"
            : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
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
}: {
  view: View;
  onViewChange: (v: View) => void;
  branches: Branch[];
  status: StatusEntry[];
  remotes: Remote[];
  tags: string[];
  stashes: Stash[];
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
          </button>
        ))}
      </div>

      <Section title="Changes" count={status.length}>
        {status.length === 0 ? (
          <Row muted icon={<FileDiff className="size-3 shrink-0" />}>
            working tree clean
          </Row>
        ) : (
          status.map((s, i) => (
            <Row
              key={`${s.path}-${i}`}
              icon={
                <span className="w-3 shrink-0 text-center text-amber-500">
                  {(s.x + s.y).trim() || "?"}
                </span>
              }
            >
              {s.path}
            </Row>
          ))
        )}
      </Section>

      <Section title="Branches" count={branches.length}>
        {branches.map((b) => (
          <Row
            key={b.name}
            active={b.is_current}
            icon={
              b.is_current ? (
                <Check className="size-3 shrink-0 text-emerald-500" />
              ) : (
                <GitBranch className="size-3 shrink-0" />
              )
            }
          >
            {b.name}
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
          <Row key={s.reff} icon={<Archive className="size-3 shrink-0" />}>
            {s.message}
          </Row>
        ))}
      </Section>
    </div>
  );
}
