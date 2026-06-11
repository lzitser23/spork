import { useEffect, type ReactNode } from "react";
import { EyeOff } from "lucide-react";

/** A lightweight right-click menu pinned at (x, y). Closes on any click,
 *  Escape, or scroll/resize. */
export function ContextMenu({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-background p-1 text-[12px] shadow-lg"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

export function ContextMenuItem({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** The context menu for a file row (in the Files tree or the Changes list). */
export function FileContextMenu({
  file,
  x,
  y,
  onGitignore,
  onClose,
}: {
  file: string;
  x: number;
  y: number;
  onGitignore: (file: string) => void;
  onClose: () => void;
}) {
  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <ContextMenuItem
        icon={<EyeOff className="size-3.5 shrink-0" />}
        onClick={() => {
          onGitignore(file);
          onClose();
        }}
      >
        Add to .gitignore
      </ContextMenuItem>
    </ContextMenu>
  );
}
