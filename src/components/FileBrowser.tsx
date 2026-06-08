import { useEffect, useMemo, useState } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileTree } from "@/components/FileTree";
import { FileView } from "@/components/FileView";
import { buildTree } from "@/lib/tree";
import { listFiles } from "@/lib/git";

export function FileBrowser({ repoPath }: { repoPath: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel
        defaultSize="280px"
        minSize="160px"
        maxSize="520px"
        groupResizeBehavior="preserve-pixel-size"
      >
        <div className="flex h-full flex-col border-r border-border">
          <div className="shrink-0 border-b border-border/40 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
            {paths.length} {paths.length === 1 ? "file" : "files"}
          </div>
          <div className="flex-1 overflow-auto">
            <FileTree nodes={nodes} selected={selected} onSelect={setSelected} />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <FileView repoPath={repoPath} file={selected} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
