import { expect, test } from "vitest";

import { splitPrDiff } from "@/lib/prDiff";

const TWO_FILES = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
-const c = 3;
+const c = 4;
diff --git a/README.md b/README.md
index 3333333..4444444 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
 # Title
+New line
`;

test("splits a multi-file diff into per-file sections with counts", () => {
  const files = splitPrDiff(TWO_FILES);

  expect(files.map((f) => f.path)).toEqual(["src/a.ts", "README.md"]);
  expect(files[0].additions).toBe(2);
  expect(files[0].deletions).toBe(1);
  expect(files[1].additions).toBe(1);
  expect(files[1].deletions).toBe(0);
  expect(files[0].diff.startsWith("diff --git a/src/a.ts")).toBe(true);
  expect(files[0].diff).toContain("+const b = 2;");
  expect(files[0].diff).not.toContain("README");
});

test("a deleted file takes its path from the pre-image side", () => {
  const diff = `diff --git a/old.txt b/old.txt
deleted file mode 100644
index 1111111..0000000
--- a/old.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-gone
-also gone
`;
  const files = splitPrDiff(diff);
  expect(files).toHaveLength(1);
  expect(files[0].path).toBe("old.txt");
  expect(files[0].deletions).toBe(2);
  expect(files[0].additions).toBe(0);
});

test("a pure rename (no ---/+++ lines) falls back to the header path", () => {
  const diff = `diff --git a/docs/old name.md b/docs/new name.md
similarity index 100%
rename from docs/old name.md
rename to docs/new name.md
`;
  const files = splitPrDiff(diff);
  expect(files).toHaveLength(1);
  expect(files[0].path).toBe("docs/new name.md");
});

test("ignores preamble before the first file section", () => {
  const files = splitPrDiff(`Some non-diff banner\n${TWO_FILES}`);
  expect(files).toHaveLength(2);
});

test("empty input yields no files", () => {
  expect(splitPrDiff("")).toEqual([]);
});
