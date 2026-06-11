import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { TitleBar, type WindowChromeClient } from "@/components/TitleBar";
import type { RepoInfo } from "@/lib/git";

const repo: RepoInfo = {
  path: "D:\\DEV\\spork",
  name: "spork",
  branch: "feat/decorations",
  head: "bf7a164",
};

function fakeChrome(maximized = false): WindowChromeClient {
  let currentMaximized = maximized;
  return {
    minimize: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockImplementation(async () => {
      currentMaximized = !currentMaximized;
    }),
    close: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockImplementation(async () => currentMaximized),
    onResized: vi.fn().mockResolvedValue(() => {}),
  };
}

function renderTitleBar(chrome = fakeChrome()) {
  const props = {
    repo,
    busy: false,
    webUrl: "https://github.com/example/spork",
    hostLabel: "GitHub",
    onRefresh: vi.fn(),
    onOpen: vi.fn(),
    onClone: vi.fn(),
    onFetch: vi.fn(),
    onPull: vi.fn(),
    onPush: vi.fn(),
    onStash: vi.fn(),
    onOpenWebUrl: vi.fn(),
    windowChrome: chrome,
  };

  render(<TitleBar {...props} />);
  return props;
}

test("renders repo identity and preserves git toolbar actions", () => {
  renderTitleBar();

  expect(screen.getAllByText("spork")).toHaveLength(2);
  expect(screen.getByText("feat/decorations")).toBeInTheDocument();
  expect(screen.getByText("bf7a164")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /fetch/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /pull/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /push/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /stash/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /github/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /clone/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /open/i })).toBeEnabled();
});

test("marks the title bar as draggable while blocking action and window-control zones", () => {
  renderTitleBar();

  expect(screen.getByTestId("title-bar")).toHaveAttribute("data-tauri-drag-region", "deep");
  expect(screen.getByTestId("title-bar-actions")).toHaveAttribute(
    "data-tauri-drag-region",
    "false",
  );
  expect(screen.getByTestId("window-controls")).toHaveAttribute(
    "data-tauri-drag-region",
    "false",
  );
});

test("routes window control buttons through the window chrome client", async () => {
  const user = userEvent.setup();
  const chrome = fakeChrome();
  renderTitleBar(chrome);

  await user.click(screen.getByRole("button", { name: /minimize window/i }));
  await user.click(screen.getByRole("button", { name: /maximize window/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /restore window/i })).toBeInTheDocument(),
  );
  await user.click(screen.getByRole("button", { name: /close window/i }));

  expect(chrome.minimize).toHaveBeenCalledTimes(1);
  expect(chrome.toggleMaximize).toHaveBeenCalledTimes(1);
  expect(chrome.close).toHaveBeenCalledTimes(1);
});
