import { afterEach, expect, test, vi } from "vitest";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "0.1.0") }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => "win32") }));

import { checkForUpdate, dismissUpdate, isNewer } from "@/lib/updateCheck";

function stubLatestRelease(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => body })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("isNewer compares numeric segments and tolerates a v prefix", () => {
  expect(isNewer("v0.2.0", "0.1.0")).toBe(true);
  expect(isNewer("0.1.1", "0.1.0")).toBe(true);
  expect(isNewer("v0.1.0", "0.1.0")).toBe(false);
  expect(isNewer("0.0.9", "0.1.0")).toBe(false);
  expect(isNewer("1.0", "0.9.9")).toBe(true);
});

test("a newer release is reported with its page url", async () => {
  stubLatestRelease({
    tag_name: "v0.2.0",
    html_url: "https://github.com/lzitser23/spork/releases/tag/v0.2.0",
  });
  expect(await checkForUpdate()).toEqual({
    version: "v0.2.0",
    url: "https://github.com/lzitser23/spork/releases/tag/v0.2.0",
    asset: null,
  });
});

test("a release with the platform package and its checksum offers self-update", async () => {
  stubLatestRelease({
    tag_name: "v0.2.0",
    html_url: "url",
    assets: [
      { name: "spork-macos-universal.app.zip", browser_download_url: "https://gh/mac" },
      { name: "spork-windows-x64-portable.exe", browser_download_url: "https://gh/exe" },
      { name: "spork-windows-x64-portable.exe.sha256", browser_download_url: "https://gh/exe.sha256" },
    ],
  });
  expect((await checkForUpdate())?.asset).toEqual({
    name: "spork-windows-x64-portable.exe",
    downloadUrl: "https://gh/exe",
    checksumUrl: "https://gh/exe.sha256",
  });
});

test("a release package without a checksum sidecar falls back to the page", async () => {
  stubLatestRelease({
    tag_name: "v0.2.0",
    html_url: "url",
    assets: [{ name: "spork-windows-x64-portable.exe", browser_download_url: "https://gh/exe" }],
  });
  expect((await checkForUpdate())?.asset).toBeNull();
});

test("the running version is not an update", async () => {
  stubLatestRelease({ tag_name: "v0.1.0", html_url: "url" });
  expect(await checkForUpdate()).toBeNull();
});

test("a dismissed release stays quiet, but a newer one still shows", async () => {
  dismissUpdate("v0.2.0");
  stubLatestRelease({ tag_name: "v0.2.0", html_url: "url" });
  expect(await checkForUpdate()).toBeNull();

  stubLatestRelease({ tag_name: "v0.3.0", html_url: "url" });
  expect(await checkForUpdate()).not.toBeNull();
});

test("no releases yet (404) means no update", async () => {
  stubLatestRelease({}, false);
  expect(await checkForUpdate()).toBeNull();
});
