/**
 * Split a multi-file unified diff (e.g. `gh pr diff`) into per-file sections,
 * so the UI can show a file list and render one file's patch at a time.
 */

export interface PrFileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

/** The file a diff section touches: the post-image path (pre-image for deletes). */
function sectionPath(lines: string[]): string {
  for (const l of lines) {
    if (l.startsWith("+++ b/")) return l.slice(6);
  }
  for (const l of lines) {
    if (l.startsWith("--- a/")) return l.slice(6);
  }
  // Binary, mode-only, and pure-rename sections have no ---/+++ lines; fall
  // back to the "diff --git a/<path> b/<path>" header. Taking everything after
  // the last " b/" stays correct for paths containing spaces.
  const header = lines[0] ?? "";
  const i = header.lastIndexOf(" b/");
  return i >= 0 ? header.slice(i + 3) : header;
}

export function splitPrDiff(diff: string): PrFileDiff[] {
  const files: PrFileDiff[] = [];
  let section: string[] | null = null;

  const flush = () => {
    if (!section) return;
    let additions = 0;
    let deletions = 0;
    for (const l of section) {
      if (l.startsWith("+") && !l.startsWith("+++")) additions += 1;
      else if (l.startsWith("-") && !l.startsWith("---")) deletions += 1;
    }
    files.push({
      path: sectionPath(section),
      diff: section.join("\n"),
      additions,
      deletions,
    });
  };

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flush();
      section = [line];
    } else if (section) {
      section.push(line);
    }
  }
  flush();
  return files;
}
