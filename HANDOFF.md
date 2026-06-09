# Spork — Handoff

> A native, **pure-black, all-monospace** desktop Git client.
> Last updated: 2026-06-08

This doc is the single place to get oriented: what Spork is, how it's built, how to
run it on this machine, what's done, and what's next. (It's an internal dev doc —
consider gitignoring it before open-sourcing, since it lists local machine paths.)

---

## 1. What it is

Spork is a small, fast desktop Git client with a deliberately minimal aesthetic:
a true-black background (`oklch(0 0 0)`) and **everything** rendered in JetBrains
Mono. It's a standalone product (no external-app comparisons).

Layout is a classic three-pane client:

```
┌────────────────────────────────────────────────────────────┐
│ toolbar: spork | repo [branch] hash | Fetch Pull Push Stash │
│          [host↗]                         Refresh Clone Open  │
├──────────────┬─────────────────────────────────────────────┤
│ Sidebar      │  Commit history (badges · author · hash · t) │
│  History     │ ───────────────────────────────────────────  │
│  Files       │  Commit detail  │  Per-file diff (red/green)  │
│ ──────────   │  (author, SHA,  │                             │
│  Changes     │   parents, files)│                            │
│  Branches    │                  │                            │
│  Remotes     │  — or, in Files view —                        │
│  Tags        │  File tree  │  Line-numbered read-only code   │
│  Stashes     │             │                                 │
└──────────────┴─────────────────────────────────────────────┘
```

---

## 2. Tech stack

| Layer        | Choice                                                        |
| ------------ | ------------------------------------------------------------- |
| Shell        | **Tauri 2** (Rust) — native window + WebView2                 |
| Backend      | Rust; shells out to the system `git` CLI and parses output    |
| Frontend     | **React 19 + TypeScript + Vite**                              |
| Components   | **shadcn/ui**, style **`base-nova`** (built on **Base UI**, not Radix) |
| Styling      | **Tailwind CSS v4** (`@tailwindcss/vite`), CSS-variable theme |
| Font         | JetBrains Mono (bundled via `@fontsource-variable/jetbrains-mono`) |
| Auth         | Delegated to the system **Git Credential Manager** — Spork stores no credentials |

---

## 3. Repository & git state

- **GitHub:** `https://github.com/lzitser23/spork` (private; can flip to public later via Settings → Danger Zone)
- **Branches:** `main` (pushed, tracking `origin/main`). Create a dev branch with `git switch -c dev && git push -u origin dev`.
- **Local folder:** still `E:\Lzitser\spoon` (the folder was *not* renamed — doing so while the dev server runs is risky; it doesn't affect the GitHub repo name).
- **git identity:** `lzitser23 <lzitser23@gmail.com>`
- `.gitattributes` enforces **LF**; `.gitignore` excludes `node_modules/` and `src-tauri/target/`.
- History (Fork-free, verified):
  ```
  chore: standalone product description
  chore: rename project Spoon -> Spork
  feat: three-pane UI, diff viewer, multi-platform clone, file browser
  Initial commit: Spoon - a black, monospace Git client
  ```
  > Project was originally named **Spoon**, then renamed to **Spork**. The initial
  > commit keeps the old name (it's real history).

---

## 4. Build & run (Windows — important!)

This machine needs a specific environment to compile the Rust side. **`dev.ps1`
handles all of it** — just run:

```powershell
.\dev.ps1        # sources VS env + adds cargo to PATH, then `npm run tauri dev`
```

### Why it's not just `npm run tauri dev`
Three machine-specific gotchas (all solved, documented here so they're never re-debugged):

1. **cargo isn't on PATH.** Rust was installed via `winget` (`Rustlang.Rustup`),
   which lands `rustup` with no default toolchain — had to run `rustup default stable`.
   cargo/rustc live at `C:\Users\lzits\.cargo\bin`.
2. **MSVC linker not auto-found.** `cargo build` fails `linker link.exe not found`
   even though VS 2019 Community has the VC++ tools. Fix: source
   `C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat`.
3. **Windows SDK was missing.** After vcvars, linking then failed `LNK1181: cannot
   open kernel32.lib`. Fixed by installing the SDK once (admin):
   `winget install --id Microsoft.WindowsSDK.10.0.19041 -e`.

`dev.ps1` captures the vcvars environment (via `cmd /c '"<vcvars>" && set'`) into the
PowerShell process, prepends `~/.cargo/bin` to PATH, then runs Tauri.

### Release build
```powershell
# from a shell with the same env (e.g., run vcvars first):
npm run tauri build
```

### Prereqs already installed
Node v22, npm 11, git 2.51, WebView2 148, Rust (stable-msvc), VS 2019 C++ tools, Windows 10 SDK 19041.

---

## 5. Architecture

### Backend — `src-tauri/src/`
- **`git.rs`** — all git logic. Each `#[tauri::command]` shells out to `git`
  (`run_git()` helper) and returns serde-serializable structs. Commands:
  - Read: `open_repo`, `git_log` (with ref decorations), `git_status`, `git_branches`,
    `git_remotes`, `git_tags`, `git_stashes`, `commit_details`, `commit_files`,
    `file_diff`, `list_files` (`git ls-files`), `read_file` (binary/size-guarded).
  - Actions: `git_fetch`, `git_pull`, `git_push`, `git_stash`, `git_clone`, `git_add_remote`.
  - Helpers: `resolve_toplevel()` (finds repo root from any subpath, handles `.git`),
    `parse_refs()` (turns `%D` decorations into colored badges).
- **`lib.rs`** — registers all commands in `tauri::generate_handler![...]` and inits
  plugins (`opener`, `dialog`).
- **`main.rs`** — `spork_lib::run()`.
- Crate name is `spork` / lib `spork_lib`; bundle id `com.lzitser.spork`.

### Frontend — `src/`
- **`lib/git.ts`** — typed `invoke()` wrappers + TS interfaces mirroring the Rust structs 1:1.
- **`lib/format.ts`** — `relativeTime`, `fullDate`, `statusStyle`.
- **`lib/remote.ts`** — `remoteWebUrl` (any host → https web URL), `remoteHostLabel`
  (GitHub/GitLab/Bitbucket/Azure/Gitea/SourceHut/host).
- **`lib/tree.ts`** — `buildTree` (flat `git ls-files` paths → nested folder tree).
- **`components/`** — `Sidebar`, `CommitList`, `CommitDetail`, `DiffView`,
  `FileBrowser`, `FileTree`, `FileView`, `CloneDialog`.
- **`components/ui/`** — shadcn primitives: `button`, `badge`, `separator`,
  `scroll-area`, `resizable`, `tooltip`.
- **`App.tsx`** — orchestrator: toolbar, all state, the nested-resizable layout, and
  the History/Files view switch.
- **`main.tsx`** — entry; wraps `<App/>` in `<TooltipProvider delay={400}>`.
- **`index.css`** — Tailwind import + shadcn theme, overridden to pure-black + mono
  (the `/* Spork: pure-black, monospace overrides */` block sets `--background: oklch(0 0 0)`
  and `--font-sans`/`--font-mono` to JetBrains Mono).

### How they talk
React calls `invoke("command_name", { args })` → Rust command runs `git` → returns
JSON → typed back in `git.ts`. Tauri maps camelCase JS args to snake_case Rust params.

---

## 6. Features (done)

- **Open** a local repo (native folder dialog); resolves the work-tree root from any
  subfolder, and from `.git` it climbs to the parent.
- **Clone** from any URL (HTTPS or SSH), host-aware; private repos trigger the system
  credential-manager browser sign-in. Works for GitHub/GitLab/Bitbucket/Azure/self-hosted.
- **Open in browser** — host-aware button jumps to the repo's web page.
- **Fetch / Pull / Push / Stash** — wired to git, with hover tooltips.
- **Sidebar:** History/Files view nav (pinned top), then collapsible **Changes,
  Branches** (current ✓), **Remotes, Tags, Stashes**.
- **Commit history:** colored **ref badges** (HEAD/branch/remote/tag) + Author · Hash · Time columns.
- **Commit detail:** subject, body, author, committer, SHA, parents, and changed
  files with `+/-` counts and status colors.
- **Diff viewer:** click a file → unified diff with red/green line coloring.
- **File browser (Files view):** tree of tracked files (`git ls-files`) + file count;
  line-numbered, read-only code view; binary/`>2 MB` files show a placeholder.
  *(Purpose: confirm a clone landed + peek at code. Intentionally not an IDE.)*
- **Hover tooltips** on every terse/icon-only toolbar control.
- Pure-black + JetBrains Mono everywhere; resizable panels throughout.

---

## 7. Key decisions & learnings

- **Resizable sizing quirk:** in base-nova's `react-resizable-panels`, **numeric**
  sizes mean *pixels*, **string** sizes mean *percent*. Use `"260px"` / `"58%"`.
  (A bare `24` made the sidebar 24px wide — the original collapse bug.)
- **Auth = system GCM.** Spork never handles credentials; it runs `git` and the OS
  credential manager does the sign-in. That's why multi-platform "just works."
- **base-nova uses Base UI**, not Radix. Composition is via the `render` prop
  (e.g. `<TooltipTrigger render={<Button/>} />`), not Radix's `asChild`.
- **Commit early, commit often.** Testing the in-app **Stash** button on Spork's *own*
  uncommitted repo swept all work into a stash (recovered with `git stash pop`; the new
  untracked files survived because plain `git stash` ignores untracked). Everything is
  committed now — but **don't run destructive actions on Spork's own repo.**
- **Standalone positioning.** Removed all external-app comparisons from code, README,
  and commit messages.

---

## 8. Not done yet / roadmap

Highest-impact first:

1. **Commit graph lanes** — the colored branch/merge topology lines. The one big
   visual piece still missing; needs a real lane-assignment algorithm.
2. **Branch operations from the UI** — create / checkout / delete. Sidebar currently
   only *lists* branches.
3. **Working-tree staging** — stage/unstage/commit from the UI (the "Changes" section
   is read-only today).
4. **Stash management** — pop/apply/drop (only create + list exist).
5. **Syntax highlighting** in the file + diff views (currently plain monospace).
6. **Search / filter** — commits and files.
7. **Merge-commit diffs** — `diff-tree` currently yields an empty file list for merges.
8. **Tags / remotes / submodules** management; remote branch checkout.

### Before open-sourcing
- Add a **`LICENSE`** (MIT/Apache-2.0/GPL) — without one, "public" still means all
  rights reserved.
- History is clean (no secrets), so flipping to public is safe content-wise.
- Consider `.gitignore`-ing this `HANDOFF.md` (machine paths).

---

## 9. Gotchas for the next session

- **Run via `.\dev.ps1`** for a window that stays up. An agent-launched `tauri dev`
  dies when the window is closed or the background task is recycled.
- **cargo isn't on PATH** — use `dev.ps1` or the full vcvars+`~/.cargo/bin` env.
- **Don't test Stash / (future) Reset / Discard on Spork's own repo.** Use a throwaway repo.
- The local folder is `spoon`; the project/app/repo is `spork`. Not a bug — just history.
