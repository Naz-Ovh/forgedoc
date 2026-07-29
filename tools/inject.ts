/**
 * Placeholder replacement — the mechanism behind "zero generation tokens for the
 * runtime" (§2.4).
 *
 * The authoring agent ends its HTML with exactly:
 *
 * ```html
 * <style>/*@PLAN_CSS@*\/</style>
 * <script>//@PLAN_JS@</script>
 * ```
 *
 * and this module swaps both for the real bundle contents. The runtime is never
 * emitted by the model.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CSS_PLACEHOLDER = '/*@PLAN_CSS@*/';
export const JS_PLACEHOLDER = '//@PLAN_JS@';

/**
 * The whole placeholder tags, for the `link` mode that replaces them outright.
 *
 * `<style>` cannot carry an `href`, so referencing the CDN means swapping the
 * element, not its contents. Tolerant of attributes and inner whitespace even
 * though the contract asks for the two lines byte for byte — a stray attribute
 * should not silently fall through to an unreplaced placeholder.
 */
const CSS_TAG = /<style\b[^>]*>\s*\/\*@PLAN_CSS@\*\/\s*<\/style>/;
const JS_TAG = /<script\b[^>]*>\s*\/\/@PLAN_JS@\s*<\/script>/;

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
declare const __PLANKIT_CDN_BASE__: string;
export const CDN_BASE =
  typeof __PLANKIT_CDN_BASE__ === 'string'
    ? __PLANKIT_CDN_BASE__
    : 'https://cdn.jsdelivr.net/npm/plankit@latest/dist';

/**
 * Does this document contain a Mermaid figure?
 *
 * Drives two things at once: whether `--offline` warns about the payload, and
 * (once the split lands) whether the offline bundle needs to carry Mermaid at
 * all. Deliberately a scan of the source rather than a parse — the answer is
 * needed before the document is known to be valid.
 */
export function usesMermaid(html: string): boolean {
  return /<plan-figure\b[^>]*\btype\s*=\s*["']?mermaid\b/i.test(html);
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
  requirePlaceholder(html, CSS_PLACEHOLDER, '<style>/*@PLAN_CSS@*/</style>');
  requirePlaceholder(html, JS_PLACEHOLDER, '<script>//@PLAN_JS@</script>');

  if (assets.mode === 'embed') {
    return html.replace(CSS_PLACEHOLDER, () => assets.css).replace(JS_PLACEHOLDER, () => assets.js);
  }

  const stylesheet = `<link rel="stylesheet" href="${assets.cssHref}">`;
  const script = `<script src="${assets.jsSrc}" defer></script>`;

  // `defer` and end-of-body both hold: elements upgrade once, after parse, with
  // every child present (§5.2). The stylesheet moves to <head> so the reader
  // never sees a flash of unstyled semantic markup.
  return hoistToHead(html.replace(CSS_TAG, ''), stylesheet).replace(JS_TAG, () => script);
}

/**
 * Put the stylesheet link in `<head>`, falling back to the end of the document.
 *
 * `<link rel="stylesheet">` in `<body>` is honoured by every browser but is not
 * conforming HTML, and this library is held to its own validator.
 */
function hoistToHead(html: string, tag: string): string {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, () => `${tag}\n</head>`);
  if (/<body\b[^>]*>/i.test(html))
    return html.replace(/<body\b[^>]*>/i, (open) => `${open}\n${tag}`);
  return `${tag}\n${html}`;
}

function requirePlaceholder(html: string, placeholder: string, expectedTag: string): void {
  if (html.includes(placeholder)) return;

  throw new InjectionError(
    `The file has no \`${placeholder}\` placeholder, so there is nothing to inject.`,
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
): Promise<InjectionAssets> {
  if (flavour === 'cdn') {
    return {
      mode: 'link',
      cssHref: `${CDN_BASE}/plankit.css`,
      jsSrc: `${CDN_BASE}/plankit.iife.js`,
    };
  }

  const [css, js] = await Promise.all([
    readBundle(resolve(from, 'plankit.css')),
    readBundle(resolve(from, 'plankit.standalone.iife.js')),
  ]);

  return { mode: 'embed', css, js };
}

async function readBundle(path: string): Promise<string> {
  try {
    const contents = await readFile(path, 'utf8');
    return stripSourcemapComment(contents);
  } catch {
    throw new InjectionError(
      `Cannot read the built bundle at ${path}.`,
      'Run `pnpm build` in the plankit checkout first, or install the package from npm.',
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
