/**
 * Acceptance 13: CDN mode works — a plain HTML file with one `<link>` and one
 * `defer` `<script>` behaves identically to the injected build.
 *
 * The two tags point at the real built artefacts, served over HTTP by the same
 * dev server the visual suite uses. That is exactly the shape of the snippet in
 * README.md, minus the unpkg hostname.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

const FIXTURE = fileURLToPath(new URL('../fixtures/offline-doc.html', import.meta.url));
const BUNDLE = fileURLToPath(new URL('../../dist/forgedoc.iife.js', import.meta.url));
const STYLESHEET = fileURLToPath(new URL('../../dist/forgedoc.css', import.meta.url));

/** The same document, wired for CDN delivery instead of injection. */
function cdnDocument(): string {
  return readFileSync(FIXTURE, 'utf8')
    .replace('<style>/*@DOC_CSS@*/</style>', '<link rel="stylesheet" href="/cdn/forgedoc.css">')
    .replace('<script>//@DOC_JS@</script>', '<script defer src="/cdn/forgedoc.iife.js"></script>');
}

/**
 * Serve the page and the two artefacts, byte for byte.
 *
 * why the bundles are fulfilled from disk rather than fetched from the dev
 * server: Vite rewrites any `.js` it serves into an ES module, which a plain
 * `<script defer src>` cannot execute. A CDN serves the file unmodified, and so
 * does this.
 */
async function openCdnPage(page: Page): Promise<void> {
  await page.route('**/cdn-mode.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: cdnDocument() }),
  );
  await page.route('**/cdn/forgedoc.iife.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: readFileSync(BUNDLE, 'utf8') }),
  );
  await page.route('**/cdn/forgedoc.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: readFileSync(STYLESHEET, 'utf8') }),
  );

  await page.goto('/cdn-mode.html');
  await page.locator('doc-page[data-doc-up]').waitFor();
}

test('upgrades every element from a deferred script tag', async ({ page }) => {
  await openCdnPage(page);

  /*
   * MUST (§5.2): `defer` means elements are defined after the document is
   * parsed, so each one upgrades once with all of its children present. If that
   * ordering broke, the options below would be missing their letter keys.
   */
  await expect(page.locator('doc-section').first()).toHaveAttribute('data-number', '1');
  await expect(page.locator('doc-toc [data-part="entry"]')).toHaveCount(2);

  const keys = await page
    .locator('doc-option')
    .evaluateAll((options) => options.map((option) => (option as HTMLElement).dataset.key));
  expect(keys).toEqual(['A', 'B', 'O']);
});

test('mounts the bucket and answers persist', async ({ page }) => {
  await openCdnPage(page);

  await expect(page.locator('[data-part="bucket-count"]')).toHaveText('0');
  await page.locator('doc-option').first().click();
  await expect(page.locator('[data-part="bucket-count"]')).toHaveText('1');
});
