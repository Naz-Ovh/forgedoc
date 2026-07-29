/**
 * Prism wrapper with an explicit language allowlist.
 *
 * Shiki is ruled out (§8.6): WASM plus grammars is far too heavy for a
 * self-contained file that has to open from `file://` with no network.
 *
 * Extending the allowlist is a one-line change in `core/contract.ts` plus an
 * import below, then a rebuild. There is deliberately no dynamic loading — the
 * validator rejects an unknown `lang` at build time so a reader never sees a
 * silent fallback to plain text.
 */

// MUST stay first: sets `Prism.manual` before Prism initialises.
import './prism-manual.js';

import Prism from 'prismjs/components/prism-core.js';

// Dependency order matters — `typescript` extends `javascript`, which extends
// `clike`; `tsx` extends both `jsx` and `typescript`.
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-toml.js';
import 'prismjs/components/prism-diff.js';
import 'prismjs/components/prism-http.js';

import type { CodeLanguage } from '../core/contract.js';

/** Vocabulary language → Prism grammar id. `text` deliberately has no grammar. */
const GRAMMAR_BY_LANGUAGE: Record<CodeLanguage, string | null> = {
  ts: 'typescript',
  js: 'javascript',
  tsx: 'tsx',
  jsx: 'jsx',
  html: 'markup',
  css: 'css',
  json: 'json',
  bash: 'bash',
  sh: 'bash',
  sql: 'sql',
  rust: 'rust',
  python: 'python',
  yaml: 'yaml',
  toml: 'toml',
  diff: 'diff',
  http: 'http',
  text: null,
};

/**
 * Highlight `source`, returning HTML.
 *
 * Falls back to escaped plain text for `text` and for any language whose grammar
 * failed to load — which the validator should already have made impossible.
 */
export function highlightToHtml(source: string, language: string): string {
  const grammarId = GRAMMAR_BY_LANGUAGE[language as CodeLanguage] ?? null;
  if (!grammarId) return escapeHtml(source);

  const grammar = Prism.languages[grammarId];
  if (!grammar) return escapeHtml(source);

  return Prism.highlight(source, grammar, grammarId);
}

/** The `class` Prism expects on a `<code>` element, for theme selectors. */
export function languageClass(language: string): string {
  return `language-${GRAMMAR_BY_LANGUAGE[language as CodeLanguage] ?? 'none'}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
