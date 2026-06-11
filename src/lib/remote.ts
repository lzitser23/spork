/**
 * Convert a git remote URL to its https web URL — works for any host
 * (GitHub, GitLab, Bitbucket, Azure DevOps, self-hosted, ...).
 * Handles HTTPS, scp-like SSH (`git@host:owner/repo`), and `ssh://` URLs.
 */
export function remoteWebUrl(url: string): string | null {
  let u = url.trim();
  if (!u) return null;

  // scp-like syntax: git@github.com:owner/repo(.git)
  const scp = u.match(/^[\w.+-]+@([\w.-]+):(.+)$/);
  if (scp) {
    u = `https://${scp[1]}/${scp[2]}`;
  }

  u = u.replace(/^ssh:\/\/(?:[^@/]+@)?/, "https://").replace(/^git:\/\//, "https://");
  u = u.replace(/\.git$/, "");

  // Security-load-bearing: a cloned repo controls its remote URL, and the
  // result of this function is the only thing handed to the opener plugin
  // (App.tsx `onOpenWebUrl`). Returning only http(s) URLs is what stops a
  // hostile remote (`file://…`, a custom scheme) from being launched. Keep
  // this http(s)-only guard if you ever route this value elsewhere.
  return /^https?:\/\//.test(u) ? u : null;
}

/** Host part of a remote URL (e.g. "github.com"), or null. */
function remoteHost(url: string): string | null {
  const web = remoteWebUrl(url);
  if (web) {
    try {
      return new URL(web).host;
    } catch {
      /* fall through */
    }
  }
  const scp = url.match(/^[\w.+-]+@([\w.-]+):/);
  return scp ? scp[1] : null;
}

/**
 * Friendly platform name for a remote URL — recognizes the big hosts,
 * otherwise returns the bare host so self-hosted GitLab/Gitea/etc. still label nicely.
 */
export function remoteHostLabel(url: string): string | null {
  const host = remoteHost(url);
  if (!host) return null;
  const h = host.toLowerCase();
  if (h.includes("github")) return "GitHub";
  if (h.includes("gitlab")) return "GitLab";
  if (h.includes("bitbucket")) return "Bitbucket";
  if (h.includes("dev.azure") || h.includes("visualstudio.com")) return "Azure DevOps";
  if (h.includes("gitea") || h.includes("codeberg")) return "Gitea";
  if (h.includes("sourcehut") || h === "git.sr.ht") return "SourceHut";
  return host;
}
