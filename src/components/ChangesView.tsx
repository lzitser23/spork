import { useState, type MouseEvent, type ReactNode } from "react";
import { Check, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { statusStyle } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChangeView } from "@/components/ChangeView";
import { FileContextMenu } from "@/components/ContextMenu";
import type { StatusEntry } from "@/lib/git";

function Group({
  title,
  count,
  actionLabel,
  onAction,
  busy,
  children,
}: {
  title: string;
  count: number;
  actionLabel?: string;
  onAction?: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
        <span>{title}</span>
        <span className="tabular-nums">{count}</span>
        {onAction && count > 0 && (
          <button
            type="button"
            onClick={onAction}
            disabled={busy}
            className="ml-auto rounded px-1 text-[10px] normal-case tracking-normal text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {count === 0 ? (
        <div className="px-3 pb-1 text-[11px] text-muted-foreground/40">none</div>
      ) : (
        <div className="pb-1">{children}</div>
      )}
    </div>
  );
}

function FileRow({
  entry,
  letter,
  selected,
  onSelect,
  icon,
  actionLabel,
  onAction,
  onContextMenu,
  busy,
}: {
  entry: StatusEntry;
  letter: string;
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  actionLabel: string;
  onAction: () => void;
  onContextMenu: (e: MouseEvent) => void;
  busy: boolean;
}) {
  const st = statusStyle(letter);
  return (
    <div
      onContextMenu={onContextMenu}
      className={cn(
        "flex items-center gap-1 px-2",
        selected ? "bg-muted" : "hover:bg-muted/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
      >
        <span className={cn("w-3 shrink-0 text-center text-[11px]", st.className)}>
          {st.label}
        </span>
        <span className="truncate text-[12px] text-muted-foreground">{entry.path}</span>
      </button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={busy}
        title={actionLabel}
        aria-label={actionLabel}
        onClick={onAction}
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        {icon}
      </Button>
    </div>
  );
}

export function ChangesView({
  repoPath,
  status,
  selected,
  onSelect,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
  onCommit,
  onGitignore,
  busy,
}: {
  repoPath: string;
  status: StatusEntry[];
  selected: string | null;
  onSelect: (path: string) => void;
  onStage: (file: string) => void;
  onUnstage: (file: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onCommit: (message: string, stageAll: boolean) => Promise<boolean>;
  onGitignore: (file: string) => void;
  busy: boolean;
}) {
  const [message, setMessage] = useState("");
  const [menu, setMenu] = useState<{ file: string; x: number; y: number } | null>(null);

  // y = working-tree status (unstaged); x = index status (staged). A file can be
  // in both lists at once (e.g. "MM": staged edit + further unstaged edit).
  const unstaged = status.filter((s) => s.y !== " ");
  const staged = status.filter((s) => s.x !== " " && s.x !== "?");
  const selectedEntry = selected ? status.find((s) => s.path === selected) : undefined;

  // When nothing is staged, the Commit button stages everything first ("Commit
  // all") so you can commit unstaged/untracked changes directly.
  const stageAll = staged.length === 0;
  const canCommit = !busy && (staged.length > 0 || unstaged.length > 0) && message.trim().length > 0;
  const commit = async () => {
    if (!canCommit) return;
    const ok = await onCommit(message, stageAll);
    if (ok) setMessage("");
  };

  const openMenu = (file: string) => (e: MouseEvent) => {
    e.preventDefault();
    setMenu({ file, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize="46%" minSize="25%">
          <div className="flex h-full flex-col border-t border-border">
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              <Group
                title="Unstaged"
                count={unstaged.length}
                actionLabel="Stage all"
                onAction={onStageAll}
                busy={busy}
              >
                {unstaged.map((s) => (
                  <FileRow
                    key={`u-${s.path}`}
                    entry={s}
                    letter={s.y}
                    selected={selected === s.path}
                    onSelect={() => onSelect(s.path)}
                    icon={<Plus />}
                    actionLabel="Stage"
                    onAction={() => onStage(s.path)}
                    onContextMenu={openMenu(s.path)}
                    busy={busy}
                  />
                ))}
              </Group>
              <Group
                title="Staged"
                count={staged.length}
                actionLabel="Unstage all"
                onAction={onUnstageAll}
                busy={busy}
              >
                {staged.map((s) => (
                  <FileRow
                    key={`s-${s.path}`}
                    entry={s}
                    letter={s.x}
                    selected={selected === s.path}
                    onSelect={() => onSelect(s.path)}
                    icon={<Minus />}
                    actionLabel="Unstage"
                    onAction={() => onUnstage(s.path)}
                    onContextMenu={openMenu(s.path)}
                    busy={busy}
                  />
                ))}
              </Group>
              {status.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted-foreground/60">
                  working tree clean — nothing to commit
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Commit message…"
                rows={3}
                spellCheck={false}
                className="w-full resize-none rounded-md border border-border bg-transparent px-2 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground/40 focus:border-muted-foreground/40"
              />
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground/60">
                  {staged.length > 0 ? `${staged.length} staged` : `${unstaged.length} unstaged`}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={!canCommit}
                  onClick={commit}
                >
                  <Check /> {stageAll ? "Commit all" : "Commit"}
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="54%" minSize="25%">
          <div className="h-full border-l border-t border-border">
            {selectedEntry ? (
              <ChangeView repoPath={repoPath} change={selectedEntry} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/50">
                select a file to view its diff
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {menu && (
        <FileContextMenu
          file={menu.file}
          x={menu.x}
          y={menu.y}
          onGitignore={onGitignore}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
