//! Syntax highlighting via Shiki.
//!
//! We use Shiki's singleton shorthand (`codeToTokens`), which lazily loads
//! grammars/themes on demand, and we render the returned token colors on the
//! app's pure-black background — the theme's own background is ignored.

import { codeToTokens } from "shiki";

const THEME = "github-dark-default";
/** Skip highlighting very large inputs to keep the UI responsive. */
const MAX_CHARS = 100_000;

/** File extension (and a few special filenames) → Shiki language id. */
const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "jsonc",
  rs: "rust",
  py: "python",
  rb: "ruby",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  vue: "vue",
  svelte: "svelte",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  md: "markdown",
  markdown: "markdown",
  mdx: "mdx",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  ini: "ini",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  lua: "lua",
  r: "r",
  dart: "dart",
  ex: "elixir",
  exs: "elixir",
};

/** Resolve a Shiki language id for a repo-relative path, or null if unknown. */
export function langForPath(path: string): string | null {
  const name = (path.split("/").pop() ?? path).toLowerCase();
  if (name === "dockerfile") return "docker";
  if (name === "makefile") return "make";
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1) : "";
  return EXT_LANG[ext] ?? null;
}

export interface Token {
  content: string;
  color?: string;
}

/**
 * Highlight `code` into per-line token arrays. Returns null (caller falls back
 * to plain text) for unknown languages, oversized input, or any failure.
 */
export async function highlightLines(code: string, lang: string): Promise<Token[][] | null> {
  if (code.length > MAX_CHARS) return null;
  try {
    // Shiki types lang/theme as bundled-string unions; our values are dynamic.
    const { tokens } = await codeToTokens(code, { lang: lang as never, theme: THEME as never });
    return tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color })));
  } catch {
    return null;
  }
}
