/**
 * Acceptance 3 and 6, end to end, against a real `file://` document.
 *
 * why this lives with the Playwright suite rather than with the browser unit
 * tests: those run the *source* through Vite. This one runs `forgedoc build`,
 * opens the resulting single file from disk with **every network request
 * blocked**, and drives it like a reader would. It is the only test that
 * exercises the primary delivery mode as delivered.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

const CLI = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../fixtures/offline-doc.html', import.meta.url));

let workspace: string;
let builtFile: string;

test.beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'forgedoc-offline-'));
  builtFile = join(workspace, 'offline.built.html');
  // `--offline` is explicit: the default flavour links a pinned CDN, which is
  // exactly what this suite blocks. Without the flag every assertion below
  // fails for the wrong reason.
  execFileSync(process.execPath, [CLI, 'build', FIXTURE, '--offline', '--out', builtFile], {
    stdio: 'pipe',
  });
});

test.afterAll(() => rmSync(workspace, { recursive: true, force: true }));

/** Open the built file with the network hard-blocked, collecting any attempts. */
async function openOffline(page: Page): Promise<{ attempted: string[]; errors: string[] }> {
  const attempted: string[] = [];
  const errors: string[] = [];

  await page.route('**/*', (route) => {
    const url = route.request().url();
    const local = ['file://', 'data:', 'blob:'].some((scheme) => url.startsWith(scheme));
    if (local) return route.continue();
    attempted.push(url);
    return route.abort();
  });

  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(pathToFileURL(builtFile).href);
  await page.locator('doc-page[data-doc-up]').waitFor();
  return { attempted, errors };
}

test('opens from file:// with no network and no errors', async ({ page }) => {
  const { attempted, errors } = await openOffline(page);

  expect(attempted, 'the offline document reached for the network').toEqual([]);
  expect(errors).toEqual([]);
});

test('derives numbering, ids, letter keys and the TOC', async ({ page }) => {
  await openOffline(page);

  await expect(page.locator('doc-section').first()).toHaveAttribute('data-number', '1');
  await expect(page.locator('doc-section').first()).toHaveAttribute(
    'id',
    'sec-what-is-being-checked',
  );
  await expect(page.locator('doc-toc [data-part="entry"]')).toHaveCount(2);

  const keys = await page
    .locator('doc-option')
    .evaluateAll((options) => options.map((option) => (option as HTMLElement).dataset.key));
  expect(keys).toEqual(['A', 'B', 'O']);
});

/*
 * MUST (§5.4 / §8.2): the global is the API. The IIFE wrapper makes the module
 * namespace *be* `window.ForgeDoc`, so `ForgeDoc.chips.add(…)` — the call
 * documented in SKILL.md — has to resolve without an extra hop.
 */
test('exposes the documented global API', async ({ page }) => {
  await openOffline(page);

  const api = await page.evaluate(() => {
    const kit = (window as unknown as { ForgeDoc?: Record<string, unknown> }).ForgeDoc;
    return {
      version: typeof kit?.version,
      chipsAdd: typeof (kit?.chips as { add?: unknown })?.add,
      store: typeof kit?.store,
      vocabulary: Array.isArray(kit?.vocabulary),
    };
  });

  expect(api).toEqual({
    version: 'string',
    chipsAdd: 'function',
    store: 'function',
    vocabulary: true,
  });
});

test('stamps the version onto doc-page', async ({ page }) => {
  await openOffline(page);
  await expect(page.locator('doc-page')).toHaveAttribute('data-forgedoc', /^\d+\.\d+\.\d+/);
});

test('keeps an answer across a reload', async ({ page }) => {
  await openOffline(page);

  await expect(page.locator('[data-part="bucket-count"]')).toHaveText('0');
  await page.locator('doc-option').first().click();
  await expect(page.locator('[data-part="bucket-count"]')).toHaveText('1');

  // The store debounces writes; give it its window before navigating away.
  await page.waitForTimeout(400);
  await page.reload();
  await page.locator('doc-page[data-doc-up]').waitFor();

  await expect(page.locator('doc-option input').first()).toBeChecked();
  await expect(page.locator('[data-part="bucket-count"]')).toHaveText('1');
});

/*
 * The Copy button is the only way a reader ever produces an FB block, so that is
 * what this drives — the click, not the serializer behind it.
 *
 * why the clipboard is stubbed rather than read back: `navigator.clipboard.read`
 * needs a permission this context cannot grant on a `file://` origin, and the
 * panel already falls back to a "Press ⌘C" label when the write is refused —
 * which would make this pass while copying nothing.
 */
test('produces a valid FB v1 block from the panel', async ({ page }) => {
  await openOffline(page);

  await page.evaluate(() => {
    const target = window as unknown as { __copied?: string };
    target.__copied = '';
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (text: string) => {
        target.__copied = text;
      },
    });
  });

  await page.locator('doc-option').first().click();
  await page.waitForTimeout(400);

  await page.locator('[data-part="bucket-trigger"]').click();
  await page.locator('[data-part="bucket-copy"]').click();
  await expect(page.locator('[data-part="bucket-copy"]')).toHaveText('Copied');

  const block = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);

  // The timestamp is stamped at click time, so match its shape, not a value.
  expect(block).toMatch(/^=== FB v1 · offline-check · \d{4}-\d{2}-\d{2}T[\d:.]+Z · 1 item ===/);
  expect(block).toContain('a: Yes — bundle it');
  expect(block.trimEnd().endsWith('=== end FB v1 ===')).toBe(true);
});
