import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import { GitClientProvider } from "@/lib/gitClient";
import { useRepoSession, type RepoSessionOptions } from "@/lib/repoSession";
import { createFakeGit, makeCommit } from "@/test/fakeGit";

function setup(fake = createFakeGit(), options: RepoSessionOptions = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GitClientProvider value={fake.client}>{children}</GitClientProvider>
  );
  const hook = renderHook(() => useRepoSession(options), { wrapper });
  return { fake, hook };
}

afterEach(() => {
  vi.useRealTimers();
});

test("open loads a snapshot and selects the newest commit", async () => {
  const { fake, hook } = setup();

  await act(async () => {
    await hook.result.current.open("/repo");
  });

  expect(hook.result.current.snapshot?.info.name).toBe("repo");
  expect(hook.result.current.snapshot?.branches).toHaveLength(1);
  expect(hook.result.current.selectedHash).toBe(fake.state.commits[0].hash);
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.error).toBeNull();
});

test("an open during a load is queued and runs after it, not dropped", async () => {
  const { fake, hook } = setup();

  await act(async () => {
    void hook.result.current.open("/a");
    void hook.result.current.open("/b");
  });

  const opens = fake.calls.filter((c) => c.method === "openRepo");
  expect(opens.map((c) => c.args[0])).toEqual(["/a", "/b"]);
  expect(hook.result.current.busy).toBe(false);
});

test("run executes the action against the repo, then reloads the snapshot", async () => {
  const { fake, hook } = setup();
  await act(async () => {
    await hook.result.current.open("/repo");
  });
  fake.calls.length = 0;

  await act(async () => {
    await hook.result.current.run("checkout dev", (g, p) => g.checkout(p, "dev"));
  });

  expect(fake.methods()[0]).toBe("checkout");
  expect(fake.methods()).toContain("log"); // the reload happened
  expect(hook.result.current.snapshot?.info.branch).toBe("dev");
  expect(hook.result.current.error).toBeNull();
  expect(hook.result.current.busy).toBe(false);
});

test("a failed action surfaces its label in the error and stops being busy", async () => {
  const { fake, hook } = setup();
  await act(async () => {
    await hook.result.current.open("/repo");
  });
  fake.state.errors.checkout = "would clobber local changes";

  await act(async () => {
    await hook.result.current.run("checkout dev", (g, p) => g.checkout(p, "dev"));
  });

  expect(hook.result.current.error).toBe("checkout dev: would clobber local changes");
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.snapshot?.info.branch).toBe("main");
});

test("external changes reload and notify, but the user's own action is muted", async () => {
  vi.useFakeTimers();
  const notify = vi.fn();
  const { fake, hook } = setup(createFakeGit(), { notify, fetchIntervalMs: 0 });

  await act(async () => {
    await hook.result.current.open("/repo");
  });
  expect(fake.watcherCount()).toBe(1);

  // A genuine external change: reload + notification.
  await act(async () => {
    fake.fireRepoChange();
  });
  expect(notify).toHaveBeenCalledWith("external-change");
  notify.mockClear();

  // The ripple of a user action arrives within the suppression window: muted.
  await act(async () => {
    await hook.result.current.run("stage", (g, p) => g.stage(p, "x.ts"));
  });
  await act(async () => {
    fake.fireRepoChange();
  });
  expect(notify).not.toHaveBeenCalled();

  // Once the window passes, external changes notify again.
  await act(async () => {
    vi.advanceTimersByTime(2000);
    fake.fireRepoChange();
  });
  expect(notify).toHaveBeenCalledWith("external-change");
});

test("the watcher mutes its own reload ripple, so it can't loop forever", async () => {
  vi.useFakeTimers();
  const notify = vi.fn();
  const { fake, hook } = setup(createFakeGit(), { notify, fetchIntervalMs: 0 });

  await act(async () => {
    await hook.result.current.open("/repo");
  });
  const logs = () => fake.calls.filter((c) => c.method === "log").length;
  const base = logs();

  // A genuine external change reloads once and notifies.
  await act(async () => {
    fake.fireRepoChange();
  });
  expect(logs()).toBe(base + 1);
  expect(notify).toHaveBeenCalledWith("external-change");
  expect(hook.result.current.busy).toBe(false);

  // Events arriving in the reload's tail — its own `git status` ripple, settling
  // fetch refs — are muted, so no extra reload fires and it can't chain into a
  // loop that pins the app permanently "busy".
  notify.mockClear();
  await act(async () => {
    fake.fireRepoChange();
    fake.fireRepoChange();
  });
  expect(logs()).toBe(base + 1);
  expect(notify).not.toHaveBeenCalled();
  expect(hook.result.current.busy).toBe(false);

  // Once the tail passes, real external changes reload again.
  await act(async () => {
    vi.advanceTimersByTime(2000);
    fake.fireRepoChange();
  });
  expect(logs()).toBe(base + 2);
  expect(notify).toHaveBeenCalledWith("external-change");
});

test("background fetch notifies only when the remote tips actually move", async () => {
  vi.useFakeTimers();
  const notify = vi.fn();
  const { fake, hook } = setup(createFakeGit(), { notify, fetchIntervalMs: 1000 });

  await act(async () => {
    await hook.result.current.open("/repo");
  });

  // First tick: tips unchanged — fetches quietly, no notification.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100);
  });
  expect(fake.methods()).toContain("fetch");
  expect(notify).not.toHaveBeenCalled();

  // The remote moves: next tick reloads and notifies.
  fake.state.remoteTips = "refs/remotes/origin/main deadbeef00";
  fake.state.commits = [
    makeCommit({ hash: "deadbeef00", short_hash: "deadbee", subject: "remote work" }),
    ...fake.state.commits,
  ];
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(notify).toHaveBeenCalledWith("remote-updated");
  expect(hook.result.current.snapshot?.commits[0]?.subject).toBe("remote work");
});

test("commit succeeds even when the push fails, and the push error survives the reload", async () => {
  const { fake, hook } = setup();
  fake.state.status = [{ x: "M", y: " ", path: "a.ts" }];
  fake.state.errors.push = "remote rejected";
  await act(async () => {
    await hook.result.current.open("/repo");
  });

  let ok = false;
  await act(async () => {
    ok = await hook.result.current.commit("ship it", false, true);
  });

  expect(ok).toBe(true);
  expect(hook.result.current.error).toBe("push: remote rejected");
  expect(hook.result.current.snapshot?.commits[0]?.subject).toBe("ship it");
  expect(hook.result.current.snapshot?.status).toEqual([]);
});

test("a failed commit reports the error and leaves the working tree alone", async () => {
  const { fake, hook } = setup();
  fake.state.status = [{ x: "M", y: " ", path: "a.ts" }];
  fake.state.errors.commit = "empty message";
  await act(async () => {
    await hook.result.current.open("/repo");
  });

  let ok = true;
  await act(async () => {
    ok = await hook.result.current.commit("", false, false);
  });

  expect(ok).toBe(false);
  expect(hook.result.current.error).toBe("commit: empty message");
  expect(hook.result.current.snapshot?.status).toHaveLength(1);
});

test("selection survives a refresh while the commit still exists, then falls back", async () => {
  const fake = createFakeGit({
    commits: [
      makeCommit({ hash: "new1111111", short_hash: "new1111", subject: "newest" }),
      makeCommit({ hash: "old0000000", short_hash: "old0000", subject: "older" }),
    ],
  });
  const { hook } = setup(fake);
  await act(async () => {
    await hook.result.current.open("/repo");
  });
  expect(hook.result.current.selectedHash).toBe("new1111111");

  act(() => hook.result.current.selectHash("old0000000"));
  await act(async () => {
    hook.result.current.refresh();
  });
  expect(hook.result.current.selectedHash).toBe("old0000000");

  // The selected commit disappears (e.g. rebase): fall back to the newest.
  fake.state.commits = [makeCommit({ hash: "rebased000", short_hash: "rebased" })];
  await act(async () => {
    hook.result.current.refresh();
  });
  expect(hook.result.current.selectedHash).toBe("rebased000");
});
