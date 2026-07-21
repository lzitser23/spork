import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";

/** GitHub's "latest release" endpoint — already excludes drafts and prereleases. */
const LATEST_RELEASE_URL = "https://api.github.com/repos/lzitser23/spork/releases/latest";

const DISMISSED_KEY = "spork.dismissed-release";

/** The self-update package for this platform, when the release ships one. */
export interface UpdateAsset {
  name: string;
  downloadUrl: string;
  checksumUrl: string;
}

export interface ReleaseUpdate {
  /** Release tag, e.g. "v0.2.0". */
  version: string;
  /** GitHub release page with the downloads. */
  url: string;
  /** In-app update package, or null — then the toast falls back to the page. */
  asset: UpdateAsset | null;
}

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

/**
 * The platform's update package + its `.sha256` sidecar from the release's
 * assets. Null when either is missing (older releases) or the platform has no
 * self-update (then the toast offers the release page instead).
 */
async function findUpdateAsset(assets: ReleaseAsset[]): Promise<UpdateAsset | null> {
  const platform = await invoke<string>("update_platform").catch(() => null);
  const matches = (name: string) =>
    platform === "darwin"
      ? name.endsWith(".app.zip")
      : platform === "win32"
        ? name.endsWith("-portable.exe")
        : false;
  const asset = assets.find((a) => a.name && a.browser_download_url && matches(a.name));
  if (!asset?.name) return null;
  const checksum = assets.find((a) => a.name === `${asset.name}.sha256`);
  if (!checksum?.browser_download_url) return null;
  return {
    name: asset.name,
    downloadUrl: asset.browser_download_url as string,
    checksumUrl: checksum.browser_download_url,
  };
}

/** Numeric-segment version compare, tolerant of a leading "v". */
export function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string) =>
    v.trim().replace(/^v/i, "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * The latest GitHub release, if it's newer than the running app and the user
 * hasn't dismissed it. Callers treat any rejection as "no update" — an update
 * check must never surface an error.
 */
export async function checkForUpdate(): Promise<ReleaseUpdate | null> {
  const res = await fetch(LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return null; // 404 = no releases yet
  const release = (await res.json()) as {
    tag_name?: string;
    html_url?: string;
    assets?: ReleaseAsset[];
  };
  if (!release.tag_name || !release.html_url) return null;
  if (localStorage.getItem(DISMISSED_KEY) === release.tag_name) return null;
  if (!isNewer(release.tag_name, await getVersion())) return null;
  return {
    version: release.tag_name,
    url: release.html_url,
    asset: await findUpdateAsset(release.assets ?? []),
  };
}

/** Stop notifying about this release (until an even newer one ships). */
export function dismissUpdate(version: string) {
  localStorage.setItem(DISMISSED_KEY, version);
}
