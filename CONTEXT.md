# Spork — context for contributors and agents

Spork is a native desktop Git client (Tauri 2 + React 19) with a pure-black,
all-monospace UI. The project folder is named `spoon` for historical reasons —
the app was renamed to Spork; only the directory name survives.

This file is the orientation map: the layers, the vocabulary, the invariants,
and the recipes. Decision rationale lives in [docs/adr/](docs/adr/).

## Layer map

```
git CLI (system binary, credential helpers, config)
  ▲ std::process::Command — never a shell
src-tauri/src/git.rs        Tauri commands: thin git-CLI wrappers, arg hardening
src-tauri/src/git/parse.rs  pure parsers: porcelain text → serde structs (unit-tested)
src-tauri/src/watch.rs      filesystem watcher → "repo_changed" events
src-tauri/src/lib.rs        registers every command + plugin (opener, dialog)
  ▲ Tauri invoke / events
src/lib/gitClient.ts        GitClient interface + tauriGitClient adapter — THE seam
src/lib/repoSession.ts      useRepoSession: all repo state (snapshot, busy, error,
                            selection, watcher, background fetch, action runner)
src/lib/workingChange.ts    derive staged/unstaged rows from status entries
src/lib/git.ts              shared TS types mirroring the Rust structs
src/lib/remote.ts           remote URL → web URL (security-load-bearing http(s) guard)
src/lib/graph.ts, tree.ts, format.ts, highlight.ts   pure helpers (lanes, file tree, dates, shiki)
  ▲ props
src/App.tsx                 composition root: wires session → layout
src/components/*            presentational: TitleBar, Sidebar, CommitList/Graph,
                            CommitDetail, ChangesView/ChangeView, DiffView,
                            FileBrowser/FileTree/FileView, CloneDialog, ContextMenu
```

## Vocabulary

- **Snapshot** (`RepoSnapshot`) — everything the UI shows about the open repo
  (info, commits, branches, status, remotes, tags, stashes, submodules), always
  loaded as one unit. There is no per-slice refresh; any change reloads the whole
  snapshot. Loads are queued/deduped inside the session.
- **Session** (`useRepoSession`) — the repo state machine. Components never call
  git directly; they call `session.run(label, fn)`, which executes the action,
  reloads the snapshot, and surfaces failures as `error` prefixed with `label`.
- **GitClient seam** — the only boundary between React and the backend. Prod
  uses `tauriGitClient` (one `invoke` per method); tests inject the in-memory
  fake via `GitClientProvider`. Components obtain it with `useGit()`.
- **Porcelain parsing** — Rust parsers consume machine-stable git output
  (`--porcelain`, `--format=` with `US`/`RS` separator bytes), never the
  human-readable output.
- **Working change** — a derived staged/unstaged row for the changes view,
  computed in `workingChange.ts` from raw `StatusEntry`s (handles renames,
  conflicted states, the `old -> new` rename syntax).
- **Remote tips** — a `for-each-ref` snapshot of remote-tracking refs; the
  session diffs it across background fetches to detect that the remote actually
  moved (→ "remote-updated" notification, not just a silent fetch).
- **External change** — watcher-reported repo mutation from outside the app.
  Suppressed for ~1.5 s after the app's own actions so they don't double-toast.

## Security invariants (do not regress)

Threat model: a *cloned* repository and *pasted* strings are untrusted; the app
itself is single-user local. The guards, in order of importance:

1. **No shell, ever.** All git calls go through `Command::new("git").args(...)`
   (`run_git` in `git.rs`). Never build a shell string.
2. **Clone hardening** (`git_clone`): `-c protocol.ext.allow=never -c
   protocol.fd.allow=never` kills the `ext::sh -c …` remote-helper RCE class
   regardless of platform git defaults, and `--` stops `--upload-pack=`-style
   option injection. Keep both if you touch the argv.
3. **Free-text args get `--`** — `git tag -- <name>`, `git remote add -- <name>
   <url>`. (`checkout -b <name>` needs none: the name is consumed as `-b`'s
   value.) Any new command taking dialog text must follow suit.
4. **Path containment** (`resolve_in_repo` in `git.rs`): `read_file`/`read_image`
   canonicalize and assert the resolved path stays inside the repo, so a tracked
   symlink (`notes.txt -> ~/.ssh/id_rsa`) can't read outside the work tree. Route
   any new file-reading command through it.
5. **Opener guard**: `remoteWebUrl` (`src/lib/remote.ts`) returns only
   `http(s)://` URLs, and its result is the only thing passed to the opener
   plugin. A hostile remote URL must never reach `openUrl` unfiltered.
6. **No XSS surface**: no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere;
   repo content renders as React text children only. A real CSP is set in
   `tauri.conf.json`. Capabilities (`src-tauri/capabilities/default.json`) stay
   minimal: window controls, opener, dialog — no fs/shell plugins.

Auth is delegated entirely to the system git's credential helper; Spork never
reads, stores, or proxies credentials.

## Testing

- **Frontend** (`npm test`, vitest + jsdom): behavior-level tests render
  components/hooks against `src/test/fakeGit.ts`, an in-memory `GitClient` with
  scriptable state — no Tauri, no real git. New UI behavior should be testable
  this way; if it isn't, the logic probably belongs in `src/lib/`.
- **Rust** (`cargo test` in `src-tauri/`): unit tests on the pure parsers in
  `git/parse.rs`. Command functions themselves are deliberately thin enough not
  to need tests; keep parsing OUT of command functions and IN `parse.rs`.
- CI (`.github/workflows/build.yml`) runs both suites on push to `main` and
  builds a portable Windows exe + universal macOS dmg.

## Recipe: adding a new git feature

1. **Rust command** in `src-tauri/src/git.rs`: call `run_git(&path, &[...])`;
   apply invariant #3 if any arg is free text. Put any output parsing in
   `git/parse.rs` with a unit test.
2. **Register it** in the `generate_handler![]` list in `src-tauri/src/lib.rs`.
3. **Extend the seam**: add the method to the `GitClient` interface, the
   `tauriGitClient` adapter (`src/lib/gitClient.ts`), and the fake
   (`src/test/fakeGit.ts`) — TypeScript will point at every gap.
4. **Mutations** go through `session.run("label", (g, p) => g.yourMethod(p, …))`
   so refresh + error handling come for free. New snapshot *data* means a field
   in `RepoSnapshot` loaded in the session's snapshot loader.
5. **UI** in a component; keep it presentational (props in, callbacks out).

## Build environment quirks

- **Windows:** building needs the MSVC toolchain on the environment — run from
  an *x64 Native Tools Command Prompt* or source
  `…\VC\Auxiliary\Build\vcvars64.bat` first; `cargo` lives at `~/.cargo/bin`.
- The dev server port is fixed at 1420 (`tauri.conf.json` → `devUrl`).
- `npm run build` runs `tsc` first — type errors fail the build, so `npx tsc
  --noEmit` is the cheap pre-flight check.

## Conventions

- Pure-black theme (`#000`), JetBrains Mono everywhere, 13px base — keep new UI
  inside the existing Tailwind/shadcn tokens (`src/index.css`).
- Comments explain *why* (constraints, git quirks), not *what*; doc-comments on
  every Tauri command and `GitClient` method.
- Commit messages: short, lowercase, informal (matching the existing history).
- The git status surface treats renames as `old -> new` strings in several
  places — `workingChange.ts` and the `rsplit(" -> ")` calls in `git.rs` must
  stay in sync if you touch rename handling.
