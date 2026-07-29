/**
 * Values shared by the two bundler configs: `tsdown.config.ts`, which builds
 * what ships, and `vite.config.ts`, which runs the dev server and the tests.
 *
 * why this file exists rather than the constants living in both: the CLI tests
 * assert that a built document pins an exact CDN version, and they exercise the
 * *source* through Vite rather than the shipped bundle. When each config
 * computed `__PLANKIT_CDN_BASE__` for itself, the two were kept in step by a
 * comment — so a drift would have left the tests passing against a URL the real
 * build never emits. One definition makes that unrepresentable.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);

/** Resolve a repo-relative path. Callers sit at different depths. */
export const fromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, ROOT));

const packageJson = JSON.parse(readFileSync(fromRoot('package.json'), 'utf8')) as {
  name: string;
  version: string;
};

/**
 * The CDN origin every default-flavour document is built against.
 *
 * MUST be pinned to the exact version, never `@latest` — see the MUST in
 * `tools/inject.ts`. It tracks the *published* name so a package rename cannot
 * leave a stale URL behind.
 */
export const CDN_BASE = `https://cdn.jsdelivr.net/npm/${packageJson.name}@${packageJson.version}/dist`;

/**
 * The constants both bundlers substitute before minification.
 *
 * `dev` gates the in-page violation banner (§11.3). It must reach the bundler
 * as a literal so production output can dead-code-eliminate the whole reporter;
 * the dev server and the test runner want it on.
 */
export const defines = (dev: boolean): Record<string, string> => ({
  __PLANKIT_VERSION__: JSON.stringify(packageJson.version),
  __PLANKIT_CDN_BASE__: JSON.stringify(CDN_BASE),
  __PLANKIT_DEV__: JSON.stringify(dev),
});
