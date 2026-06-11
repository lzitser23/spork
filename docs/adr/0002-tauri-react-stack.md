# ADR 0002: Tauri 2 + React 19 + Tailwind/shadcn for the shell and UI

- **Status:** accepted
- **Date:** 2026-06-11 (recorded retroactively; decision predates the ADR log)

## Context

Spork wants to feel native — small binary, fast startup, real window controls —
while keeping UI iteration cheap. Electron gives the web DX at ~150 MB+ per
app with a bundled Chromium; pure-native toolkits (egui, Swift/WinUI per
platform) make a polished, information-dense git UI expensive to build and
triple the platform work.

## Decision

- **Tauri 2** as the shell: Rust backend, system webview (WebView2 on
  Windows, WKWebView on macOS), one codebase, single-digit-MB binaries.
- **React 19 + TypeScript + Vite** for the UI, with **shadcn/ui**
  (base-nova/Base UI) components, **Tailwind v4** styling, **shiki** for
  syntax highlighting.
- Identity: pure-black (`#000`) theme, JetBrains Mono everywhere,
  frameless window with a custom title bar (`decorations: false`).
- Backend surface = explicit Tauri commands only. Capabilities stay minimal
  (window controls, opener, dialog) — no fs/shell plugins are exposed to the
  webview; anything the UI needs from the system goes through a purpose-built
  Rust command.

## Consequences

- Small, fast app; web-speed UI iteration; one codebase for Windows/macOS/Linux.
- The Rust/TS boundary needs type mirroring (serde structs ↔ `src/lib/git.ts`)
  and a seam to stay testable — see ADR 0003.
- System webviews differ slightly per platform (rendering, CSP dialects);
  CI builds per-OS artifacts to catch issues.
- Frontend tests can't run inside Tauri — they run in jsdom against an
  injected fake client (ADR 0003), which is also just faster.
- WebView2 is preinstalled on Windows 10/11, so the portable exe needs no
  installer; Linux needs webkit2gtk from the distro.
