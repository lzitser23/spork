//! Syntax highlighting via Shiki.
//!
//! Shiki is intentionally loaded only when a diff actually needs highlighting.
//! The default bundle includes every grammar/theme; this file keeps startup
//! JavaScript small by loading one theme and each language grammar on demand,
//! while falling back to plain text for anything unrecognized.

import type { HighlighterCore, LanguageRegistration } from "shiki/core";

const THEME = "github-dark-default";
/** Skip highlighting very large inputs to keep the UI responsive. */
const MAX_CHARS = 100_000;

type SupportedLang =
  | "bash"
  | "c"
  | "cpp"
  | "csharp"
  | "css"
  | "dart"
  | "docker"
  | "elixir"
  | "go"
  | "graphql"
  | "html"
  | "ini"
  | "java"
  | "javascript"
  | "json"
  | "jsonc"
  | "jsx"
  | "kotlin"
  | "less"
  | "lua"
  | "make"
  | "markdown"
  | "mdx"
  | "php"
  | "powershell"
  | "python"
  | "r"
  | "ruby"
  | "rust"
  | "sass"
  | "scala"
  | "scss"
  | "sql"
  | "svelte"
  | "swift"
  | "toml"
  | "tsx"
  | "typescript"
  | "vue"
  | "xml"
  | "yaml";

type LanguageModule = { default: LanguageRegistration[] };
type LanguageLoader = () => Promise<LanguageModule>;

const LANG_LOADERS: Record<SupportedLang, LanguageLoader> = {
  bash: () => import("@shikijs/langs/bash"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  csharp: () => import("@shikijs/langs/csharp"),
  css: () => import("@shikijs/langs/css"),
  dart: () => import("@shikijs/langs/dart"),
  docker: () => import("@shikijs/langs/docker"),
  elixir: () => import("@shikijs/langs/elixir"),
  go: () => import("@shikijs/langs/go"),
  graphql: () => import("@shikijs/langs/graphql"),
  html: () => import("@shikijs/langs/html"),
  ini: () => import("@shikijs/langs/ini"),
  java: () => import("@shikijs/langs/java"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  jsx: () => import("@shikijs/langs/jsx"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  less: () => import("@shikijs/langs/less"),
  lua: () => import("@shikijs/langs/lua"),
  make: () => import("@shikijs/langs/make"),
  markdown: () => import("@shikijs/langs/markdown"),
  mdx: () => import("@shikijs/langs/mdx"),
  php: () => import("@shikijs/langs/php"),
  powershell: () => import("@shikijs/langs/powershell"),
  python: () => import("@shikijs/langs/python"),
  r: () => import("@shikijs/langs/r"),
  ruby: () => import("@shikijs/langs/ruby"),
  rust: () => import("@shikijs/langs/rust"),
  sass: () => import("@shikijs/langs/sass"),
  scala: () => import("@shikijs/langs/scala"),
  scss: () => import("@shikijs/langs/scss"),
  sql: () => import("@shikijs/langs/sql"),
  svelte: () => import("@shikijs/langs/svelte"),
  swift: () => import("@shikijs/langs/swift"),
  toml: () => import("@shikijs/langs/toml"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  vue: () => import("@shikijs/langs/vue"),
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
  ])
    .then(([core, engine, theme]) =>
      core.createHighlighterCore({
        themes: [theme.default],
        langs: [],
        engine: engine.createJavaScriptRegexEngine(),
      }),
    )
    .catch((e) => {
      // Don't cache a failed load forever — let the next diff retry.
      highlighterPromise = null;
      throw e;
    });
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
