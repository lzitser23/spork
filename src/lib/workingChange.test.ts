import { expect, test } from "vitest";

import { classifyChange } from "@/lib/workingChange";
import type { StatusEntry } from "@/lib/git";

const entry = (x: string, y: string, path = "file.ts"): StatusEntry => ({ x, y, path });

test("untracked file ('??') is unstaged-only with an untracked summary", () => {
  const c = classifyChange(entry("?", "?"));
  expect(c.untracked).toBe(true);
  expect(c.staged).toBe(false);
  expect(c.unstaged).toBe(true);
  expect(c.summary.text).toBe("untracked");
});

test("staged edit ('M ') sits only in the staged area", () => {
  const c = classifyChange(entry("M", " "));
  expect(c.staged).toBe(true);
  expect(c.unstaged).toBe(false);
  expect(c.summary.text).toBe("staged");
  expect(c.stagedStyle.label).toBe("M");
});

test("unstaged edit (' M') sits only in the unstaged area", () => {
  const c = classifyChange(entry(" ", "M"));
  expect(c.staged).toBe(false);
  expect(c.unstaged).toBe(true);
  expect(c.summary.text).toBe("unstaged");
  expect(c.unstagedStyle.label).toBe("M");
});

test("doubly-modified file ('MM') appears in both areas", () => {
  const c = classifyChange(entry("M", "M"));
  expect(c.staged).toBe(true);
  expect(c.unstaged).toBe(true);
  expect(c.summary.text).toBe("staged + unstaged");
});

test("staged add then delete letters come from each side's column", () => {
  const c = classifyChange(entry("A", "D"));
  expect(c.stagedStyle.label).toBe("A");
  expect(c.unstagedStyle.label).toBe("D");
});

test.each([
  ["U", "U"],
  ["A", "A"],
  ["D", "D"],
  ["U", "D"],
  [" ", "U"],
])("conflict pair (%s%s) reads as a conflict", (x, y) => {
  const c = classifyChange(entry(x, y));
  expect(c.conflicted).toBe(true);
  expect(c.summary.text).toBe("conflict");
});

test("a normal staged rename is not a conflict", () => {
  const c = classifyChange(entry("R", " ", "old.ts -> new.ts"));
  expect(c.conflicted).toBe(false);
  expect(c.stagedStyle.label).toBe("R");
});
