/** Compact "time ago" like Fork's date column (11d, 3h, 2mo). */
export function relativeTime(unixSeconds: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

/** Full local timestamp for the commit-detail panel. */
export function fullDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Map a git status letter to a label + text color for file-change rows. */
export function statusStyle(status: string): { label: string; className: string } {
  switch (status[0]) {
    case "A":
      return { label: "A", className: "text-emerald-500" };
    case "M":
      return { label: "M", className: "text-amber-500" };
    case "D":
      return { label: "D", className: "text-red-500" };
    case "R":
      return { label: "R", className: "text-sky-500" };
    case "C":
      return { label: "C", className: "text-sky-500" };
    case "T":
      return { label: "T", className: "text-violet-500" };
    default:
      return { label: status[0] ?? "?", className: "text-muted-foreground" };
  }
}
