import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { PullRequestsView } from "@/components/PullRequestsView";
import { GitClientProvider } from "@/lib/gitClient";
import { createFakeGit, makePullRequest } from "@/test/fakeGit";

const SAMPLE_DIFF = `diff --git a/notes.txt b/notes.txt
index 0000000..1111111 100644
--- a/notes.txt
+++ b/notes.txt
@@ -1,2 +1,3 @@
 line one
+line two
 line three
`;

function setup(fake = createFakeGit(), onRepoChanged = vi.fn()) {
  const onCheckout = vi.fn();
  render(
    <GitClientProvider value={fake.client}>
      <PullRequestsView
        repoPath="/repo"
        busy={false}
        onCheckout={onCheckout}
        onRepoChanged={onRepoChanged}
      />
    </GitClientProvider>,
  );
  return { fake, onCheckout, onRepoChanged };
}

test("lists open PRs and shows the selected one's files and diff", async () => {
  setup(
    createFakeGit({
      pullRequests: [
        makePullRequest({
          number: 101,
          title: "Add feature",
          author: { login: "alice" },
          additions: 2,
          deletions: 0,
        }),
        makePullRequest({ number: 102, title: "Fix bug", author: { login: "bob" } }),
      ],
      prDiffs: { 101: SAMPLE_DIFF },
    }),
  );

  // Title shows in the list row and again in the detail header.
  expect(await screen.findAllByText("Add feature")).toHaveLength(2);
  expect(screen.getByText("Fix bug")).toBeInTheDocument();

  // The first PR is auto-selected; its diff loads, split per file.
  expect(await screen.findByText("notes.txt")).toBeInTheDocument();
  expect(await screen.findByText("+line two")).toBeInTheDocument();
});

test("approve submits a review through the client", async () => {
  const user = userEvent.setup();
  const { fake } = setup(
    createFakeGit({ pullRequests: [makePullRequest({ number: 7 })] }),
  );

  await user.click(await screen.findByRole("button", { name: /approve/i }));

  const call = fake.calls.find((c) => c.method === "prReview");
  expect(call?.args).toEqual(["/repo", 7, "approve", ""]);
});

test("comment and request-changes need a body; comment sends it", async () => {
  const user = userEvent.setup();
  const { fake } = setup(
    createFakeGit({ pullRequests: [makePullRequest({ number: 7 })] }),
  );

  const comment = await screen.findByRole("button", { name: /comment/i });
  const requestChanges = screen.getByRole("button", { name: /request changes/i });
  expect(comment).toBeDisabled();
  expect(requestChanges).toBeDisabled();

  await user.type(screen.getByPlaceholderText(/review comment/i), "looks close");
  expect(comment).toBeEnabled();
  await user.click(comment);

  const call = fake.calls.find((c) => c.method === "prReview");
  expect(call?.args).toEqual(["/repo", 7, "comment", "looks close"]);
});

test("merge strategy menu merges the PR and the list reloads without it", async () => {
  const user = userEvent.setup();
  const onRepoChanged = vi.fn();
  const { fake } = setup(
    createFakeGit({ pullRequests: [makePullRequest({ number: 9, title: "Ship it" })] }),
    onRepoChanged,
  );

  await user.click(await screen.findByRole("button", { name: /merge/i }));
  await user.click(await screen.findByText("Squash and merge"));

  const call = fake.calls.find((c) => c.method === "prMerge");
  expect(call?.args).toEqual(["/repo", 9, "squash"]);
  expect(onRepoChanged).toHaveBeenCalledOnce();
  expect(await screen.findByText(/no open pull requests/i)).toBeInTheDocument();
});

test("checkout hands the PR number to the host", async () => {
  const user = userEvent.setup();
  const { onCheckout } = setup(
    createFakeGit({ pullRequests: [makePullRequest({ number: 5 })] }),
  );

  await user.click(await screen.findByRole("button", { name: /checkout/i }));
  expect(onCheckout).toHaveBeenCalledWith(5);
});

test("a missing gh CLI shows setup instructions instead of an error dump", async () => {
  const fake = createFakeGit();
  fake.state.errors.prList = "gh-not-installed";
  setup(fake);

  expect(await screen.findByText(/GitHub CLI required/i)).toBeInTheDocument();
  expect(screen.getByText(/winget install GitHub.cli/i)).toBeInTheDocument();
  expect(screen.getByText(/gh auth login/i)).toBeInTheDocument();
});

test("on macOS the install instruction is Homebrew, not winget", async () => {
  Object.defineProperty(window.navigator, "userAgent", {
    value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    configurable: true,
  });
  try {
    const fake = createFakeGit();
    fake.state.errors.prList = "gh-not-installed";
    setup(fake);

    expect(await screen.findByText(/brew install gh/i)).toBeInTheDocument();
    expect(screen.queryByText(/winget/i)).not.toBeInTheDocument();
  } finally {
    Reflect.deleteProperty(window.navigator, "userAgent");
  }
});
