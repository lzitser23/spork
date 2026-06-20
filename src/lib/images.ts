import type { CSSProperties } from "react";

/** Image kinds we preview as an `<img>` data URL (mirrors `mime_for` in git.rs). */
const IMAGE_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "avif",
  "svg",
]);

export function isImagePath(file: string): boolean {
  return IMAGE_EXT.has(file.split(".").pop()?.toLowerCase() ?? "");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// A subtle dark checkerboard so transparent images (e.g. icons) read against the
// pure-black UI instead of vanishing into it.
export const CHECKER: CSSProperties = {
  backgroundColor: "#0a0a0a",
  backgroundImage: "repeating-conic-gradient(#101010 0% 25%, #181818 0% 50%)",
  backgroundSize: "20px 20px",
};
