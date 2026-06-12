import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("shiki");
  vi.doUnmock("shiki/core");
  vi.resetModules();
});

test("path language detection does not eagerly load shiki", async () => {
  const loadShiki = vi.fn();
  vi.doMock("shiki", () => {
    loadShiki();
    return { codeToTokens: vi.fn() };
  });
  vi.doMock("shiki/core", () => {
    loadShiki();
    return { createHighlighterCore: vi.fn() };
  });

  const { langForPath } = await import("@/lib/highlight");

  expect(langForPath("src/App.tsx")).toBe("tsx");
  expect(langForPath("README.md")).toBe("markdown");
  expect(loadShiki).not.toHaveBeenCalled();
});
