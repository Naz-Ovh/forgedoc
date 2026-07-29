/**
 * Acceptance 13: CDN mode works — a plain HTML file with one `<link>` and one
 * `defer` `<script>` renders identically to the injected build.
 *
 * The two tags point at the real built artefacts, served over HTTP by the same
 * dev server the visual suite uses. That is exactly the shape of the snippet in
 * README.md, minus the unpkg hostname.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

const FIXTURE = fileURLToPath(new URL('../fixtures/offline-plan.html', import.meta.url));
const BUNDLE = fileURLToPath(new URL('../../dist/plankit.iife.js', import.meta.url));
const STYLESHEET = fileURLToPath(new URL('../../dist/plankit.css', import.meta.url));

/** The same document, wired for CDN delivery instead of injection. */
function cdnDocument(): string {
  return readFileSync(FIXTURE, 'utf8')
    .replace('<style>/*@PLAN_CSS@*/</style>', '<link rel="stylesheet" href="/cdn/plankit.css">')
    .replace('<script>//@PLAN_JS@</script>', '<script defer src="/cdn/plankit.iife.js"></script>');
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
  await page.route('**/cdn/plankit.iife.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: readFileSync(BUNDLE, 'utf8') }),
  );
  await page.route('**/cdn/plankit.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: readFileSync(STYLESHEET, 'utf8') }),
  );

  await page.goto('/cdn-mode.html');
  await page.locator('plan-doc[data-plan-up]').waitFor();
}

test('upgrades every element from a deferred script tag', async ({ page }) => {
  await openCdnPage(page);

  /*
   * MUST (§5.2): `defer` means elements are defined after the document is
   * parsed, so each one upgrades once with all of its children present. If that
   * ordering broke, the options below would be missing their letter keys.
   */
  await expect(page.locator('plan-section').first()).toHaveAttribute('data-number', '1');
  await expect(page.locator('plan-toc [data-part="entry"]')).toHaveCount(2);

  const keys = await page
    .locator('plan-option')
    .evaluateAll((options) => options.map((option) => (option as HTMLElement).dataset.key));
  expect(keys).toEqual(['A', 'B', 'O']);
});

test('applies the shipped stylesheet, layers and all', async ({ page }) => {
  await openCdnPage(page);

  // A token from plan.tokens, resolved through a real property.
  const padding = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.paddingTop = 'var(--plan-space-4)';
    document.querySelector('plan-doc')?.append(probe);
    const value = getComputedStyle(probe).paddingTop;
    probe.remove();
    return value;
  });
  expect(padding).toBe('16px');

  // A rule from plan.components.
  await expect(page.locator('plan-note')).toHaveCSS('border-radius', '8px');
});

test('a single unlayered author rule still overrides the library', async ({ page }) => {
  await openCdnPage(page);

  await page.addStyleTag({ content: 'plan-note { border-radius: 0; }' });
  await expect(page.locator('plan-note')).toHaveCSS('border-radius', '0px');
});

test('mounts the bucket and answers persist', async ({ page }) => {
  await openCdnPage(page);

  await expect(page.locator('[data-part="bucket-count"]')).toHaveText('0');
  await page.locator('plan-option').first().click();
  await expect(page.locator('[data-part="bucket-count"]')).toHaveText('1');
});
