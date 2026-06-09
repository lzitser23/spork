import { useState, type MouseEvent } from "react";
import { ChevronDown, ChevronRight, File as FileIcon, Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TreeNode } from "@/lib/tree";

function TreeItem({
  node,
  depth,
  selected,
  onSelect,
  onContextMenuFile,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
  onContextMenuFile: (file: string, e: MouseEvent) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const pad = depth * 12 + 8;

  if (node.dir) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ paddingLeft: pad }}
          className="flex w-full items-center gap-1 py-0.5 pr-2 text-left text-muted-foreground hover:bg-muted/50"
        >
          {open ? (
            <ChevronDown className="size-3 shrink-0" />
          ) : (
            <ChevronRight className="size-3 shrink-0" />
          )}
          <Folder className="size-3 shrink-0 text-sky-500/70" />
          <span className="truncate">{node.name}</span>
        </button>
        {open &&
          node.children.map((c) => (
            <TreeItem
              key={c.path}
              node={c}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              onContextMenuFile={onContextMenuFile}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      onContextMenu={(e) => onContextMenuFile(node.path, e)}
      style={{ paddingLeft: pad + 16 }}
      className={cn(
        "flex w-full items-center gap-1 py-0.5 pr-2 text-left",
        selected === node.path
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      <FileIcon className="size-3 shrink-0 text-muted-foreground/60" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({
  nodes,
  selected,
  onSelect,
  onContextMenuFile,
}: {
  nodes: TreeNode[];
  selected: string | null;
  onSelect: (path: string) => void;
  onContextMenuFile: (file: string, e: MouseEvent) => void;
}) {
  if (nodes.length === 0) {
    return <div className="p-3 text-muted-foreground/50">no tracked files</div>;
  }
  return (
    <div className="py-1 text-[12px]">
      {nodes.map((n) => (
        <TreeItem
          key={n.path}
          node={n}
          depth={0}
          selected={selected}
          onSelect={onSelect}
          onContextMenuFile={onContextMenuFile}
        />
      ))}
    </div>
  );
}
