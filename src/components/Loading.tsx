import { cn } from "@/lib/utils";
import { DotmSquare3 } from "@/components/ui/dotm-square-3";

/** Dot-matrix loading placeholder — spiral loader beside a muted lowercase label. */
export function Loading({ label = "loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 p-3 text-muted-foreground/60", className)}>
      <DotmSquare3 size={14} dotSize={2} ariaLabel={label} />
      {label}
    </div>
  );
}
