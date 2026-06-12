//! Syntax highlighting via Shiki.
//!
//! Shiki is intentionally loaded only when a diff actually needs highlighting.
//! The default bundle includes every grammar/theme; this file keeps startup
//! JavaScript small by loading one theme and a small set of common languages on
//! demand, while falling back to plain text for everything else.

import type { HighlighterCore, LanguageRegistration } from "shiki/core";

const THEME = "github-dark-default";
/** Skip highlighting very large inputs to keep the UI responsive. */
const MAX_CHARS = 100_000;

type SupportedLang =
  | "bash"
  | "c"
  | "csharp"
  | "css"
  | "docker"
  | "go"
  | "graphql"
  | "html"
  | "java"
  | "javascript"
  | "json"
  | "jsonc"
  | "jsx"
  | "kotlin"
  | "make"
  | "markdown"
  | "php"
  | "powershell"
  | "python"
  | "rust"
  | "scss"
  | "sql"
  | "swift"
  | "toml"
  | "tsx"
  | "typescript"
  | "xml"
  | "yaml";

type LanguageModule = { default: LanguageRegistration[] };
type LanguageLoader = () => Promise<LanguageModule>;

const LANG_LOADERS: Record<SupportedLang, LanguageLoader> = {
  bash: () => import("@shikijs/langs/bash"),
  c: () => import("@shikijs/langs/c"),
  csharp: () => import("@shikijs/langs/csharp"),
  css: () => import("@shikijs/langs/css"),
  docker: () => import("@shikijs/langs/docker"),
  go: () => import("@shikijs/langs/go"),
  graphql: () => import("@shikijs/langs/graphql"),
  html: () => import("@shikijs/langs/html"),
  java: () => import("@shikijs/langs/java"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  jsx: () => import("@shikijs/langs/jsx"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  make: () => import("@shikijs/langs/make"),
  markdown: () => import("@shikijs/langs/markdown"),
  php: () => import("@shikijs/langs/php"),
  powershell: () => import("@shikijs/langs/powershell"),
  python: () => import("@shikijs/langs/python"),
  rust: () => import("@shikijs/langs/rust"),
  scss: () => import("@shikijs/langs/scss"),
  sql: () => import("@shikijs/langs/sql"),
  swift: () => import("@shikijs/langs/swift"),
  toml: () => import("@shikijs/langs/toml"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  xml: () => import("@shikijs/langs/xml"),
  yaml: () => import("@shikijs/langs/yaml"),
};

/** File extension (and a few special filenames) to Shiki language id. */
const EXT_LANG: Partial<Record<string, SupportedLang>> = {
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
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cs: "csharp",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  css: "css",
  scss: "scss",
  md: "markdown",
  markdown: "markdown",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
};

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLangs = new Set<SupportedLang>();

function isSupportedLang(lang: string): lang is SupportedLang {
  return Object.prototype.hasOwnProperty.call(LANG_LOADERS, lang);
}

async function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("@shikijs/themes/github-dark-default"),
  ]).then(([core, engine, theme]) =>
    core.createHighlighterCore({
      themes: [theme.default],
      langs: [],
      engine: engine.createJavaScriptRegexEngine(),
    }),
  );
  return highlighterPromise;
}

async function ensureLanguage(highlighter: HighlighterCore, lang: SupportedLang): Promise<void> {
  if (loadedLangs.has(lang)) return;
  const mod = await LANG_LOADERS[lang]();
  await highlighter.loadLanguage(...mod.default);
  loadedLangs.add(lang);
}

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
  if (!isSupportedLang(lang)) return null;
  try {
    const highlighter = await getHighlighter();
    await ensureLanguage(highlighter, lang);
    const { tokens } = highlighter.codeToTokens(code, { lang, theme: THEME });
    return tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color })));
  } catch {
    return null;
  }
}
