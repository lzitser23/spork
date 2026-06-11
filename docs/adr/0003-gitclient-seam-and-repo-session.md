# ADR 0003: One GitClient seam and a single repo-session state machine

- **Status:** accepted
- **Date:** 2026-06-11

## Context

The first iteration had components calling `invoke()` directly and `App.tsx`
juggling a dozen `useState`s for repo data, refresh timing, watcher events,
and error handling. That made UI behavior untestable without a running Tauri
app and scattered refresh/error logic across every call site.

## Decision

Two abstractions, introduced together in the 2026-06 refactor:

1. **`GitClient`** (`src/lib/gitClient.ts`) — an interface holding every
   operation the UI can ask of a repository. Exactly two implementations:
   `tauriGitClient` (prod; one `invoke` per method) and `fakeGit`
   (`src/test/fakeGit.ts`; in-memory, scriptable). Components get it via
   `useGit()`; tests swap it with `GitClientProvider`.

2. **`useRepoSession`** (`src/lib/repoSession.ts`) — the only owner of repo
   state. It exposes a `RepoSnapshot` (all repo data, loaded as one unit) plus
   `open`/`refresh`/`run`/`commit`, and internally handles load queueing and
   dedup, selection preservation across refreshes, the file watcher, the
   background remote fetch with remote-tips diffing, and suppression of
   self-inflicted watcher events. Components are presentational: snapshot
   slices in, callbacks out. Mutations go through `session.run(label, fn)`,
   which refreshes and converts failures into a labeled `error`.

## Consequences

- UI behavior is testable in jsdom with vitest — no Tauri, no real git, no
  filesystem. The 23-test suite (session behavior, working-change derivation,
  title bar) runs in ~2 s.
- Adding an operation means touching interface + both adapters; TypeScript
  enforces every gap, and the fake stays honest because it must satisfy the
  same interface.
- Whole-snapshot refresh trades efficiency for simplicity: there is no cache
  staleness to reason about, and no per-slice invalidation logic. Acceptable
  at "local repo, 200 commits" scale; revisit only if profiling says so.
- The seam is also the security choke point: every untrusted value crossing
  to Rust goes through one reviewable file.
