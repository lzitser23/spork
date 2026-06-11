# ADR 0004: Treat cloned repos and pasted strings as hostile

- **Status:** accepted
- **Date:** 2026-06-11

## Context

Spork is a local, single-user app, but two inputs are attacker-controllable:
the contents of a repository the user clones (tracked paths, symlinks, remote
URLs) and free-text strings the user pastes (clone URLs, branch/tag/remote
names — think "hey, clone my repo: `ext::sh -c …`"). Git GUIs have a history
of remote-code-execution bugs in exactly this class, and a 2026-06 security
review of Spork found the gaps before first public release.

Two distinct vectors matter for `git clone`, and fixing one does **not** fix
the other:

- **Option injection** — a URL starting with `-` parses as a git flag
  (`--upload-pack=<cmd>` runs the command). Stopped by `--` (end of options).
- **Transport scheme** — `ext::sh -c <cmd>` is a *positional* URL whose
  remote helper executes the command. `--` does nothing here;
  `protocol.ext.allow` defaults vary by platform, so it must be pinned off
  explicitly.

## Decision

Layered guards, each enforced at the narrowest choke point:

1. `git_clone` runs
   `git -c protocol.ext.allow=never -c protocol.fd.allow=never clone -- <url> <target>`.
2. Every command taking free text uses `--` where git's grammar allows it
   (`tag -- <name>`, `remote add -- <name> <url>`). `checkout -b <name>` is
   exempt: the name is consumed as `-b`'s value and git rejects `-`-leading
   refnames.
3. `read_file`/`read_image` resolve paths via `resolve_in_repo`, which
   canonicalizes (following symlinks) and rejects results outside the repo
   root — a cloned repo tracking `notes.txt -> ~/.ssh/id_rsa` displays an
   error, not the key.
4. `remoteWebUrl` returns only `http(s)://` URLs and is the sole source for
   the opener plugin, so a hostile remote URL can't launch arbitrary schemes.
5. Defense-in-depth around the webview: no HTML-injection sinks (repo content
   renders as React text children), a real CSP in `tauri.conf.json`, and
   minimal capabilities (window/opener/dialog only).

Verified empirically against git 2.51: `--` neutralizes `--upload-pack=…`
(treated as a repo name) and `protocol.ext.allow=never` makes `ext::` fail
with `transport 'ext' not allowed` deterministically.

## Consequences

- The exotic-but-legitimate `ext::`/`fd::` transports cannot be cloned through
  Spork. Acceptable: users who need them have a terminal.
- Reading a tracked symlink that points outside the work tree now errors in
  the file browser instead of showing the target. Intentional.
- New code must keep the invariants (CONTEXT.md "Security invariants"): new
  free-text args get `--`, new file readers go through `resolve_in_repo`,
  nothing but `remoteWebUrl` output reaches `openUrl`, and capabilities stay
  minimal.
- What this explicitly does **not** cover: code signing of release binaries
  (SmartScreen/Gatekeeper warnings remain) — a distribution problem, not a
  code one.
