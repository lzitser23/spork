import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { File as FileIcon, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileTree } from "@/components/FileTree";
import { FileView } from "@/components/FileView";
import { FileContextMenu } from "@/components/ContextMenu";
import { buildTree } from "@/lib/tree";
import { listFiles } from "@/lib/git";

export function FileBrowser({
  repoPath,
  onGitignore,
}: {
  repoPath: string;
  onGitignore: (file: string) => void;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<{ file: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSelected(null);
    listFiles(repoPath)
      .then((p) => {
        if (!cancelled) setPaths(p);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath]);

  const nodes = useMemo(() => buildTree(paths), [paths]);

  if (error) return <div className="p-3 text-destructive">{error}</div>;

  const onContextMenuFile = (file: string, e: MouseEvent) => {
    e.preventDefault();
    setMenu({ file, x: e.clientX, y: e.clientY });
  };

  // While filtering, a flat list of matching paths reads better than a tree.
  const f = filter.trim().toLowerCase();
  const matches = f ? paths.filter((p) => p.toLowerCase().includes(f)) : null;

  return (
    <>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel
          defaultSize="280px"
          minSize="160px"
          maxSize="520px"
          groupResizeBehavior="preserve-pixel-size"
        >
          <div className="flex h-full flex-col border-r border-border">
            <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-2.5 py-1 text-muted-foreground/60">
              <Search className="size-3 shrink-0" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter files…"
                spellCheck={false}
                className="w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                {matches ? matches.length : paths.length}
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              {matches ? (
                matches.length === 0 ? (
                  <div className="p-3 text-[12px] text-muted-foreground/50">no matches</div>
                ) : (
                  <div className="py-1 text-[12px]">
                    {matches.map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelected(p)}
                        onContextMenu={(e) => onContextMenuFile(p, e)}
                        className={cn(
                          "flex w-full items-center gap-1 px-2 py-0.5 text-left",
                          selected === p
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        <FileIcon className="size-3 shrink-0 text-muted-foreground/60" />
                        <span className="truncate">{p}</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <FileTree
                  nodes={nodes}
                  selected={selected}
                  onSelect={setSelected}
                  onContextMenuFile={onContextMenuFile}
                />
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>
          <FileView repoPath={repoPath} file={selected} />
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
