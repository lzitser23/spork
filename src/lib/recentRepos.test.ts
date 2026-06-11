import { beforeEach, expect, test } from "vitest";

import { forgetRepo, recentRepos, rememberRepo } from "@/lib/recentRepos";

beforeEach(() => {
  localStorage.clear();
});

test("starts empty", () => {
  expect(recentRepos()).toEqual([]);
});

test("remembers repos most recent first and persists them", () => {
  rememberRepo("C:/dev/alpha");
  rememberRepo("C:/dev/beta");

  expect(recentRepos()).toEqual(["C:/dev/beta", "C:/dev/alpha"]);
});

test("re-opening an existing repo moves it to the front without duplicating", () => {
  rememberRepo("C:/dev/alpha");
  rememberRepo("C:/dev/beta");
  rememberRepo("C:/dev/alpha");

  expect(recentRepos()).toEqual(["C:/dev/alpha", "C:/dev/beta"]);
});

test("caps the list at ten entries", () => {
  for (let i = 0; i < 12; i++) rememberRepo(`C:/dev/repo-${i}`);

  const list = recentRepos();
  expect(list).toHaveLength(10);
  expect(list[0]).toBe("C:/dev/repo-11");
  expect(list).not.toContain("C:/dev/repo-0");
  expect(list).not.toContain("C:/dev/repo-1");
});

test("forget removes an entry", () => {
  rememberRepo("C:/dev/alpha");
  rememberRepo("C:/dev/beta");

  expect(forgetRepo("C:/dev/alpha")).toEqual(["C:/dev/beta"]);
  expect(recentRepos()).toEqual(["C:/dev/beta"]);
});

test("survives malformed storage", () => {
  localStorage.setItem("spork.recent-repos", "{not json");
  expect(recentRepos()).toEqual([]);

  localStorage.setItem("spork.recent-repos", JSON.stringify({ nope: true }));
  expect(recentRepos()).toEqual([]);

  localStorage.setItem("spork.recent-repos", JSON.stringify(["ok", 42, null]));
  expect(recentRepos()).toEqual(["ok"]);
});
