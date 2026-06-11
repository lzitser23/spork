/**
 * The recently-opened repository list, persisted in localStorage so the last
 * repo reopens on launch and the title bar can offer quick switching.
 * Paths are repo roots (as resolved by `open_repo`), most recent first.
 */

const STORAGE_KEY = "spork.recent-repos";
const MAX_RECENT = 10;

function save(paths: string[]): string[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Storage unavailable — the list just won't survive a restart.
  }
  return paths;
}

/** Recently opened repo roots, most recent first. */
export function recentRepos(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

/** Move `path` to the front of the recent list. Returns the updated list. */
export function rememberRepo(path: string): string[] {
  const rest = recentRepos().filter((p) => p !== path);
  return save([path, ...rest].slice(0, MAX_RECENT));
}

/** Drop `path` from the list (it no longer opens). Returns the updated list. */
export function forgetRepo(path: string): string[] {
  return save(recentRepos().filter((p) => p !== path));
}
