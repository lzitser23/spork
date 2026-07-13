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

function renderTitleBar(
  chrome = fakeChrome(),
  overrides: Partial<Parameters<typeof TitleBar>[0]> = {},
) {
  const props = {
    repo,
    busy: false,
    webUrl: "https://github.com/example/spork",
    hostLabel: "GitHub",
    hasRemote: true,
    recentRepos: [repo.path, "D:\\DEV\\other-repo"],
    onOpenRecent: vi.fn(),
    onRefresh: vi.fn(),
    onOpen: vi.fn(),
    onClone: vi.fn(),
    onFetch: vi.fn(),
    onPull: vi.fn(),
    onPush: vi.fn(),
    onStash: vi.fn(),
    onOpenWebUrl: vi.fn(),
    onLinkRemote: vi.fn(),
    windowChrome: chrome,
    ...overrides,
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

test("offers a Link action only when the repo has no remote", async () => {
  const user = userEvent.setup();
  const props = renderTitleBar(fakeChrome(), { hasRemote: false, webUrl: null });

  expect(screen.queryByRole("button", { name: /github/i })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /link/i }));
  expect(props.onLinkRemote).toHaveBeenCalledTimes(1);
});

test("hides the Link action once a remote is configured", () => {
  renderTitleBar();
  expect(screen.queryByRole("button", { name: /link/i })).not.toBeInTheDocument();
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

test("repo name opens the recent-repos menu and switches to another repo", async () => {
  const user = userEvent.setup();
  const props = renderTitleBar();

  await user.click(screen.getByTestId("repo-switcher"));

  // The current repo is listed but selecting it is a no-op.
  await user.click(await screen.findByText("D:\\DEV\\spork"));
  expect(props.onOpenRecent).not.toHaveBeenCalled();

  await user.click(screen.getByTestId("repo-switcher"));
  await user.click(await screen.findByText("D:\\DEV\\other-repo"));
  expect(props.onOpenRecent).toHaveBeenCalledWith("D:\\DEV\\other-repo");
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
