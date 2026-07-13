<p align="center">
  <img src="public/spork.svg" alt="spork logo" width="120" />
</p>

<h1 align="center">spork</h1>

<p align="center">
  <strong>A small, fast, native Git client — pure black, all monospace</strong>
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#development">Development</a> |
  <a href="#architecture">Architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-orange" alt="Platform: Windows | macOS" />
  <img src="https://img.shields.io/badge/Tauri-2.x-blue" alt="Tauri 2.x" />
  <img src="https://img.shields.io/badge/React-19-blue" alt="React 19" />
  <img src="https://img.shields.io/badge/Rust-stable-brown" alt="Rust stable" />
</p>

---

## Overview

**spork** is an open-source Tauri desktop Git client with a pure-black,
all-monospace interface. It drives the `git` you already have installed —
clone, history with graph lanes, staging, commits, sync, stashes, tags, and a
syntax-highlighted file browser — while authentication stays entirely with
your system git's credential helper. Spork never sees, stores, or proxies a
credential.

The app is built with Rust, Tauri 2, React 19, Vite, Tailwind v4, and
shadcn/ui, set in JetBrains Mono throughout. Everything runs locally against
your repositories; there is no telemetry and no network traffic beyond what
`git` itself does.

---

## Features

- **History with graph lanes** — commit list with colored branch lanes, ref
  badges, author, and relative time; click a commit for full metadata, changed
  files, and per-file patches.
- **Working tree** — staged/unstaged changes with diffs, stage/unstage per file
  or all, commit (optionally stage-all and/or push in one step), add to
  `.gitignore`.
- **Branches** — list, switch, create, delete; remote-tracking branches are
  included in the graph.
- **Sync** — fetch / pull (`--ff-only`) / push (auto-publishes new branches to
  `origin`), plus a background fetch that toasts when the remote actually
  moved.
- **Auto-refresh** — a file watcher picks up changes made outside the app
  (editor saves, terminal git commands) and reloads automatically.
- **Tags, stashes, remotes, submodules** — create/delete tags, stash
  save/pop/apply/drop, add/remove remotes, init/update submodules.
- **File browser** — tracked-file tree with a syntax-highlighted viewer (shiki)
  and image preview.
- **Clone** — paste a URL, pick a parent folder; private repos trigger your
  normal credential flow (Git Credential Manager, SSH agent, …).
- **Open on web** — jump to the repo's host page (GitHub/GitLab/Bitbucket/…)
  from the title bar.
- **Hardened against hostile repos** — no shell invocation, clone
  protocol/option-injection guards, symlink path containment, strict CSP, and
  minimal Tauri capabilities. See [docs/adr/0004](docs/adr/0004-untrusted-input-hardening.md).

---

## Installation

### Downloads

| Platform | Download | Notes |
| --- | --- | --- |
| Windows | [spork-windows-x64-portable.exe](https://github.com/lzitser23/spork/releases/download/v0.1.0/spork-windows-x64-portable.exe) | Portable single exe, no installer; WebView2 ships with Windows 10/11. |
| macOS | [spork-macos-universal.dmg](https://github.com/lzitser23/spork/releases/download/v0.1.0/spork-macos-universal.dmg) | Universal DMG (Apple Silicon + Intel), signed and notarized. |

All versions are on the [releases page](https://github.com/lzitser23/spork/releases).

**Windows:** the exe is currently unsigned, so SmartScreen may warn on first
run — choose "More info" → "Run anyway".

### Build from source

See [Development](#development) — `npm run tauri build` produces the platform
bundle.

---

## Quick Start

1. Launch spork.
2. **Open a repository** (any folder inside a work tree resolves to its root)
   or **Clone** one by pasting a URL.
3. Browse history in the graph; click any commit for its files and diffs.
4. Stage changes in the sidebar, write a message, commit — optionally pushing
   in the same step.
5. Let the background fetch and file watcher keep the view current while you
   work in your editor or terminal.

`git` must be on your PATH — spork drives your system git rather than bundling
its own, so your config, hooks, and credentials all apply as-is.

---

## Stack

| Layer | Choice |
| --- | --- |
| Shell / backend | Tauri 2 (Rust) |
| Git access | shells out to the system `git` CLI, parses porcelain |
| UI | React 19 + TypeScript + Vite |
| Components | shadcn/ui (base-nova, built on Base UI) |
| Styling | Tailwind CSS v4, true-black theme |
| Highlighting | shiki |
| Font | JetBrains Mono (bundled via `@fontsource-variable`) |

---

## Development

### Prerequisites

- Node.js 22+ and npm.
- Rust stable through [rustup](https://rustup.rs/) (`stable-msvc` on Windows).
- `git` on PATH.
- **Windows:** Visual Studio C++ build tools (MSVC linker); WebView2 is
  preinstalled on Windows 10/11.
- **Linux:** webkit2gtk and the usual [Tauri prerequisites](https://tauri.app/start/prerequisites/).

### Commands

```bash
git clone https://github.com/lzitser23/spork.git
cd spork
npm install
```

```bash
# Start the desktop app with hot reload
npm run tauri dev

# Frontend tests (vitest, jsdom, in-memory GitClient — no Tauri needed)
npm test

# Rust tests (pure porcelain parsers)
cargo test --manifest-path src-tauri/Cargo.toml

# Typecheck + build the frontend
npm run build

# Build a release bundle (or just the portable exe on Windows)
npm run tauri build
npm run tauri build -- --no-bundle
```

> **Windows note:** if `cargo` reports `linker link.exe not found`, build from
> an *"x64 Native Tools Command Prompt for VS"*, or source `vcvars64.bat` first
> so the MSVC linker and Windows SDK are on the environment.

### Project Structure

```text
spork/
|-- src/                      # React frontend
|   |-- components/           # presentational UI (TitleBar, CommitList, DiffView, ...)
|   |   `-- ui/               # shadcn/ui primitives
|   |-- lib/                  # GitClient seam, repoSession state machine, pure helpers
|   `-- test/                 # vitest setup + in-memory fake GitClient
|-- src-tauri/                # Rust/Tauri backend
|   |-- src/git.rs            # git CLI command wrappers (input-hardened)
|   |-- src/git/parse.rs      # pure porcelain parsers (unit-tested)
|   |-- src/watch.rs          # filesystem watcher -> repo_changed events
|   `-- capabilities/         # Tauri permissions (kept minimal)
|-- docs/adr/                 # architecture decision records
|-- public/                   # static assets (logo)
|-- CONTEXT.md                # orientation map for contributors and agents
`-- .github/workflows/        # CI: tests + Windows/macOS artifacts
```

---

## Architecture

The one-paragraph version: Rust commands in `src-tauri/src/git.rs` shell out to
the system git and hand porcelain output to pure parsers in
`src-tauri/src/git/parse.rs`; the React side talks to them only through the
`GitClient` interface (`src/lib/gitClient.ts`), and `useRepoSession`
(`src/lib/repoSession.ts`) owns all repo state behind a snapshot-in/actions-out
API that the components render.

- **[CONTEXT.md](CONTEXT.md)** — the full layer map, domain vocabulary,
  security invariants, and the recipe for adding a new git feature.
- **[docs/adr/](docs/adr/)** — why it shells out to git instead of embedding
  libgit2, why Tauri + React, the GitClient seam, and the untrusted-input
  hardening model.

---

## Acknowledgments

- [Tauri](https://tauri.app/)
- [shadcn/ui](https://ui.shadcn.com/) and [Base UI](https://base-ui.com/)
- [shiki](https://shiki.style/)
- [Lucide](https://lucide.dev/)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/)

---

## License

[MIT](LICENSE) © 2026 Lior Zitser

---
