# spoon 🥄

A small, native, **black + monospace** Git client — a free, build-it-yourself answer to [Fork](https://git-fork.com/).

Built with [Tauri 2](https://tauri.app/) (Rust) + React + TypeScript + [shadcn/ui](https://ui.shadcn.com/), styled pure-black with JetBrains Mono throughout.

## Status

Early MVP. Open a repository and you get:

- Branch list (current branch highlighted)
- Working-tree changes (staged / unstaged)
- Commit history (last 200 commits) with short hash, subject, author, and relative time

## Stack

| Layer            | Choice                                                   |
| ---------------- | -------------------------------------------------------- |
| Shell / backend  | Tauri 2 (Rust)                                           |
| Git access       | shells out to the system `git` CLI, parses porcelain     |
| UI               | React 19 + TypeScript + Vite                             |
| Components       | shadcn/ui (base-nova, built on Base UI)                  |
| Styling          | Tailwind CSS v4, true-black theme                        |
| Font             | JetBrains Mono (bundled via `@fontsource-variable`)      |

## Develop

Prerequisites: Node.js, Rust (stable-msvc), the system `git`, and (on Windows) the
Visual Studio C++ build tools.

```bash
npm install
npm run tauri dev      # launches the app with hot reload
```

> **Windows note:** if `cargo` reports `linker link.exe not found`, build from a
> *"x64 Native Tools Command Prompt for VS"*, or source `vcvars64.bat` first so the
> MSVC linker and Windows SDK are on the environment.

Build a release bundle:

```bash
npm run tauri build
```

## Architecture

- `src-tauri/src/git.rs` — Rust commands (`open_repo`, `git_log`, `git_status`, `git_branches`) that shell out to `git` and return typed, serde-serializable structs.
- `src-tauri/src/lib.rs` — registers the commands and Tauri plugins (opener, dialog).
- `src/lib/git.ts` — typed `invoke()` wrappers that mirror the Rust commands 1:1.
- `src/App.tsx` — the UI: toolbar, resizable sidebar (branches + changes), commit list.
- `src/index.css` — Tailwind + shadcn theme, overridden to pure black + monospace.

## Roadmap

- [ ] Commit diff viewer (selected commit → changed files → patch)
- [ ] Commit graph lanes (the colored branch lines)
- [ ] Stage / unstage / commit from the UI
- [ ] Fetch / pull / push
- [ ] Tags, remotes, and stashes in the sidebar
