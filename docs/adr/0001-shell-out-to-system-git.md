# ADR 0001: Shell out to the system git CLI instead of embedding a git library

- **Status:** accepted
- **Date:** 2026-06-11 (recorded retroactively; decision predates the ADR log)

## Context

A Git client needs a git implementation. The candidates were an embedded
library (libgit2 via `git2-rs`, or gitoxide) or driving the system `git`
binary as a subprocess and parsing its output.

The decisive constraint is **authentication**. Users already have working
credentials wired into their system git: Git Credential Manager on Windows,
osxkeychain on macOS, SSH agents, per-host config. An embedded library gets
none of that for free — it would mean reimplementing credential prompting,
token storage, and SSH handling inside Spork, and storing secrets ourselves.

## Decision

Every git operation shells out to the system `git` via
`std::process::Command` (never through a shell). Output is requested in
machine-stable form — `--porcelain`, `--format=` with ASCII unit/record
separators — and handed to pure parser functions in `src-tauri/src/git/parse.rs`.

## Consequences

- Clone/fetch/push hit the user's existing credential helpers; Spork never
  sees, stores, or proxies a credential. This is both less code and a smaller
  security surface.
- The user's git config (aliases excepted), hooks, and proxies all apply —
  Spork behaves exactly like their terminal git.
- **`git` becomes a runtime prerequisite**; there is no bundled fallback.
- Behavior can vary with the installed git version. We only rely on
  long-stable plumbing (`rev-parse`, `for-each-ref`, `diff-tree`, porcelain
  status), and we pass our own `-c` overrides where defaults matter
  (see ADR 0004).
- Parsing text is the tax. It is contained by keeping parsers pure and
  unit-tested (`cargo test`), and by never parsing human-readable output.
- A subprocess per call is fast enough in practice for a desktop client; the
  snapshot loader batches the per-refresh calls.
