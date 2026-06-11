# spork 🥄

A small, fast, native Git client with a pure-black, all-monospace interface.

Built with [Tauri 2](https://tauri.app/) (Rust) + React + TypeScript + [shadcn/ui](https://ui.shadcn.com/), styled pure-black with JetBrains Mono throughout.

## Features

- **History** — commit list with colored graph lanes, subject, author, relative time; click a commit for full metadata, changed files, and per-file patches
- **Working tree** — staged/unstaged changes with diffs, stage/unstage per file or all, commit (optionally stage-all and/or push in one step), add to `.gitignore`
- **Branches** — list, switch, create, delete; remote-tracking branches included in the graph
- **Sync** — fetch / pull (`--ff-only`) / push (auto-publishes new branches to `origin`), plus a background fetch that toasts when the remote actually moved
- **Auto-refresh** — a file watcher picks up changes made outside the app (editor saves, terminal git commands) and reloads the snapshot
- **Tags, stashes, remotes, submodules** — create/delete tags, stash save/pop/apply/drop, add/remove remotes, init/update submodules
- **File browser** — tracked-file tree with syntax-highlighted file viewer (shiki) and image preview
- **Clone** — paste a URL, pick a parent folder; auth is delegated to the system git's credential helper (Spork never sees credentials)
- **Open on web** — jump to the repo's host page (GitHub/GitLab/Bitbucket/…) from the title bar

## Stack

| Layer            | Choice                                                   |
| ---------------- | -------------------------------------------------------- |
| Shell / backend  | Tauri 2 (Rust)                                           |
| Git access       | shells out to the system `git` CLI, parses porcelain     |
| UI               | React 19 + TypeScript + Vite                             |
| Components       | shadcn/ui (base-nova, built on Base UI)                  |
| Styling          | Tailwind CSS v4, true-black theme                        |
| Highlighting     | shiki                                                    |
| Font             | JetBrains Mono (bundled via `@fontsource-variable`)      |

## Setup

Prerequisites:

- **Node.js 22+** and npm
- **Rust** (stable; `stable-msvc` toolchain on Windows) — `rustup` recommended
- **git** on PATH (Spork drives the system git; it has no bundled git)
- **Windows:** Visual Studio C++ build tools (for the MSVC linker) and WebView2 (preinstalled on Windows 10/11)
- **Linux:** webkit2gtk and the usual [Tauri prerequisites](https://tauri.app/start/prerequisites/)

```bash
npm install
npm run tauri dev      # launches the app with hot reload
```

> **Windows note:** if `cargo` reports `linker link.exe not found`, build from an
> *"x64 Native Tools Command Prompt for VS"*, or source `vcvars64.bat` first so the
> MSVC linker and Windows SDK are on the environment.

## Tests

```bash
npm test                                      # frontend (vitest, jsdom, in-memory GitClient)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust (pure porcelain parsers)
```

## Release builds

```bash
npm run tauri build                  # platform bundle
npm run tauri build -- --no-bundle   # Windows: just the portable .exe
```

CI (`.github/workflows/build.yml`) runs both test suites on every push to `main`
and uploads a portable Windows `.exe` and a universal macOS `.dmg` as artifacts.
Binaries are currently **unsigned** — expect a SmartScreen warning on Windows and
a right-click → Open dance on macOS.

## Architecture

The one-paragraph version: Rust commands in `src-tauri/src/git.rs` shell out to
the system git and hand porcelain output to pure parsers in
`src-tauri/src/git/parse.rs`; the React side talks to them only through the
`GitClient` interface (`src/lib/gitClient.ts`), and `useRepoSession`
(`src/lib/repoSession.ts`) owns all repo state behind a snapshot-in/actions-out
API that the components render.

See **[CONTEXT.md](CONTEXT.md)** for the full layer map, domain vocabulary,
security invariants, and the recipe for adding a new git feature, and
**[docs/adr/](docs/adr/)** for the reasoning behind the major decisions.
