/**
 * Placeholder replacement — the mechanism behind "zero generation tokens for the
 * runtime" (§2.4).
 *
 * The authoring agent ends its HTML with exactly:
 *
 * ```html
 * <style>/*@DOC_CSS@*\/</style>
 * <script>//@DOC_JS@</script>
 * ```
 *
 * and this module swaps both for the real bundle contents. The runtime is never
 * emitted by the model.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CSS_PLACEHOLDER = '/*@DOC_CSS@*/';
export const JS_PLACEHOLDER = '//@DOC_JS@';

/**
 * The theme compiled in when the document does not name one.
 *
 * Themes are chosen at *build* time, never at runtime: a document ships exactly
 * one stylesheet, so shipping five and switching between them would mean
 * sending four the reader never sees. `dist/themes/<name>.css` is the unit.
 */
export const DEFAULT_THEME = 'forgedoc';

/** `/*@DOC_CSS:geist@*\/` — the placeholder, naming the theme it wants. */
const CSS_PLACEHOLDER_THEMED = /\/\*@DOC_CSS(?::([a-z0-9-]+))?@\*\//;

/**
 * Which theme this document asks for, or `null` for the default.
 *
 * The name is carried by the placeholder the authoring agent writes, so the
 * choice lives in the document rather than in whatever command someone happened
 * to run — a rebuild months later produces the same document.
 */
export function themeFromPlaceholder(html: string): string | null {
  return CSS_PLACEHOLDER_THEMED.exec(html)?.[1] ?? null;
}

/**
 * The whole placeholder tags, for the `link` mode that replaces them outright.
 *
 * `<style>` cannot carry an `href`, so referencing the CDN means swapping the
 * element, not its contents. Tolerant of attributes and inner whitespace even
 * though the contract asks for the two lines byte for byte — a stray attribute
 * should not silently fall through to an unreplaced placeholder.
 */
// Takes the line's newline with it: the tag is lifted out of wherever it was
// written and re-emitted in <head>, and leaving the blank line behind would show
// up in the built file as a gap the author never typed.
const CSS_TAG = /<style\b[^>]*>\s*\/\*@DOC_CSS(?::[a-z0-9-]+)?@\*\/\s*<\/style>\n?/;
const JS_TAG = /<script\b[^>]*>\s*\/\/@DOC_JS@\s*<\/script>/;

/**
 * Where a built document gets its runtime.
 *
 * `cdn` is the default (§4.2 revised): a plan is text, and a plan that
 * references a version-pinned CDN URL stays a few kB in git while every reader
 * after the first hits a warm `immutable` cache. `offline` embeds everything
 * for the `file://` delivery path, and is opt-in because the Mermaid-bearing
 * bundle is ~3.5 MB.
 */
export type BundleFlavour = 'cdn' | 'offline';

/** Runtime embedded in the document itself. */
export interface EmbeddedAssets {
  readonly mode: 'embed';
  readonly css: string;
  readonly js: string;
}

/** Runtime referenced from a CDN. */
export interface LinkedAssets {
  readonly mode: 'link';
  readonly cssHref: string;
  readonly jsSrc: string;
}

export type InjectionAssets = EmbeddedAssets | LinkedAssets;

/**
 * The CDN origin, pinned to this exact package name and version at build time.
 *
 * MUST: pinned, never `@latest`. jsDelivr serves a version-pinned path with
 * `max-age=31536000, immutable`, which is the entire reason the CDN flavour is
 * cheap for a reader who opens more than one plan. A floating major would both
 * defeat that cache and silently re-render already-published plans with a
 * runtime they were never checked against.
 */
declare const __FORGEDOC_CDN_BASE__: string;
export const CDN_BASE =
  typeof __FORGEDOC_CDN_BASE__ === 'string'
    ? __FORGEDOC_CDN_BASE__
    : 'https://cdn.jsdelivr.net/npm/forgedoc@latest/dist';

/**
 * Does this document contain a Mermaid figure?
 *
 * Drives two things at once: whether `--offline` warns about the payload, and
 * (once the split lands) whether the offline bundle needs to carry Mermaid at
 * all. Deliberately a scan of the source rather than a parse — the answer is
 * needed before the document is known to be valid.
 */
export function usesMermaid(html: string): boolean {
  return /<doc-figure\b[^>]*\btype\s*=\s*["']?mermaid\b/i.test(html);
}

export class InjectionError extends Error {
  constructor(
    message: string,
    readonly fix: string,
  ) {
    super(message);
    this.name = 'InjectionError';
  }
}

/**
 * Replace both placeholders in `html`.
 *
 * MUST (§5.3): the replacement is a *function*, never a string. A `$&` or `$1`
 * sequence anywhere in the minified bundle — and there will be one, minifiers
 * emit `$` freely — would be interpreted as a replacement pattern and silently
 * corrupt the output.
 */
export function injectAssets(html: string, assets: InjectionAssets): string {
  requirePlaceholder(html, CSS_PLACEHOLDER_THEMED, CSS_PLACEHOLDER, '<style>/*@DOC_CSS@*/</style>');
  requirePlaceholder(html, JS_PLACEHOLDER, JS_PLACEHOLDER, '<script>//@DOC_JS@</script>');

  // The script stays where the placeholder was: end of body for the embedded
  // bundle, `defer` for the linked one. Either way elements upgrade once, after
  // parse, with every child present (§5.2). The styles are *placed*, not left —
  // both flavours put them in <head>, so the reader never sees a frame of
  // unstyled semantic markup. The skeleton already writes that placeholder in
  // <head>, which makes the hoist a no-op for anything `forgedoc new` produced;
  // it earns its keep on documents authored against the older end-of-body shape,
  // which are already committed in people's repositories.
  if (assets.mode === 'embed') {
    return hoistToHead(html.replace(CSS_TAG, ''), `<style>${assets.css}</style>`).replace(
      JS_PLACEHOLDER,
      () => assets.js,
    );
  }

  const stylesheet = `<link rel="stylesheet" href="${assets.cssHref}">`;
  const script = `<script src="${assets.jsSrc}" defer></script>`;

  return hoistToHead(html.replace(CSS_TAG, ''), stylesheet).replace(JS_TAG, () => script);
}

/**
 * Put the stylesheet in `<head>`, falling back to the end of the document.
 *
 * `<link rel="stylesheet">` in `<body>` is honoured by every browser but is not
 * compliant HTML5. More importantly, the reader's browser starts rendering the
 * unstyled body while the stylesheet request is still in flight, which produces
 * the exact flash the compiler exists to prevent.
 */
function hoistToHead(html: string, tag: string): string {
  const head = html.indexOf('</head>');
  if (head !== -1) {
    return `${html.slice(0, head)}${tag}\n${html.slice(head)}`;
  }

  // Author gave us a fragment rather than a full document (valid in tests, and
  // tolerable in an agent-authored draft before build): put it first.
  return `${tag}\n${html}`;
}

function requirePlaceholder(
  html: string,
  placeholder: string | RegExp,
  label: string,
  expectedTag: string,
): void {
  const present =
    typeof placeholder === 'string' ? html.includes(placeholder) : placeholder.test(html);
  if (present) return;

  throw new InjectionError(
    `The file has no \`${label}\` placeholder, so there is nothing to inject.`,
    `End the document body with exactly:\n      ${expectedTag}`,
  );
}

/** Directory holding the built bundles, resolved relative to this module. */
function distDirectory(): string {
  // Works from `dist/cli.js` (dist/..) and from `tools/inject.ts` via tsx (tools/..).
  const here = dirname(fileURLToPath(import.meta.url));
  return here.endsWith('dist') ? here : resolve(here, '..', 'dist');
}

/**
 * Work out what to inject.
 *
 * `cdn` touches no files at all — it resolves to two pinned URLs — which is why
 * it is both the default and effectively free. `offline` is the only path that
 * reads the 3.5 MB standalone bundle off disk.
 */
export async function resolveAssets(
  flavour: BundleFlavour = 'cdn',
  from: string = distDirectory(),
  theme: string = DEFAULT_THEME,
): Promise<InjectionAssets> {
  if (flavour === 'cdn') {
    // The CDN path reads no files, so nothing else would notice a theme that
    // does not exist — the document would build clean and 404 its stylesheet in
    // the reader's browser, which is the worst place to find out. The names on
    // disk are the same ones published to the CDN.
    await requireTheme(theme, from);

    return {
      mode: 'link',
      cssHref: `${CDN_BASE}/themes/${theme}.css`,
      jsSrc: `${CDN_BASE}/forgedoc.iife.js`,
    };
  }

  const [css, js] = await Promise.all([
    readBundle(resolve(from, 'themes', `${theme}.css`)),
    readBundle(resolve(from, 'forgedoc.standalone.iife.js')),
  ]);

  return { mode: 'embed', css, js };
}

/** Fail with the list of themes that do exist, rather than a bare "not found". */
async function requireTheme(theme: string, from: string): Promise<void> {
  let available: string[];
  try {
    available = (await readdir(resolve(from, 'themes')))
      .filter((entry) => entry.endsWith('.css'))
      .map((entry) => entry.replace(/\.css$/, ''))
      .sort();
  } catch {
    // No dist/themes at all: `readBundle`'s "run the build first" message is
    // the more useful one, and the offline path will produce it.
    return;
  }

  if (available.includes(theme)) return;

  throw new InjectionError(
    `There is no theme called "${theme}".`,
    `Available themes: ${available.join(', ')}. Name one with \`--theme <name>\`, or in the ` +
      `document itself as \`<style>/*@DOC_CSS:<name>@*/</style>\`.`,
  );
}

async function readBundle(path: string): Promise<string> {
  try {
    const contents = await readFile(path, 'utf8');
    return stripSourcemapComment(contents.replace(/^\uFEFF/, ''));
  } catch {
    throw new InjectionError(
      `Cannot read the built bundle at ${path}.`,
      'Run `pnpm build` in the forgedoc checkout first, or install the package from npm.',
    );
  }
}

/**
 * Drop the trailing `//# sourceMappingURL=…` comment.
 *
 * why: the injected document is a single file with no sibling `.map`, so the
 * comment only produces a 404 (or, from `file://`, a console error) for every
 * reader who opens devtools.
 */
function stripSourcemapComment(contents: string): string {
  return contents.replace(/\n?\/[/*]# sourceMappingURL=[^\n]*\*?\/?\s*$/, '').trimEnd();
}
