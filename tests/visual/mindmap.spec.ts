/**
 * `doc-mindmap` end to end: built offline, opened from `file://`, driven with
 * a real mouse, keyboard and viewport — the input paths the browser unit tests
 * can only simulate with synthetic events.
 *
 * As everywhere in this suite, appearance is out of scope: no screenshots and
 * no computed styles. What is asserted is behaviour — which cards are open,
 * where focus is, that the map pans and zooms, that a phone gets an outline
 * with no sideways scroll, and that print shows every card.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

const CLI = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../fixtures/mindmap-doc.html', import.meta.url));

let workspace: string;
let builtFile: string;

test.beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'forgedoc-mindmap-'));
  builtFile = join(workspace, 'mindmap.built.html');
  execFileSync(process.execPath, [CLI, 'build', FIXTURE, '--offline', '--out', builtFile], {
    stdio: 'pipe',
  });
});

test.afterAll(() => rmSync(workspace, { recursive: true, force: true }));

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(pathToFileURL(builtFile).href);
  await page.locator('doc-mindmap[data-doc-up]').waitFor();
  return errors;
}

const card = (page: Page, title: string) => page.locator(`doc-node[title="${title}"]`);

test('opens and closes branches with the mouse and the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await open(page);

  await expect(card(page, 'customers')).not.toHaveAttribute('hidden');
  await expect(card(page, 'Guards')).toHaveAttribute('hidden', 'until-found');

  await card(page, 'Server').locator(':scope > [data-part="header"] > [data-part="title"]').click();
  await expect(card(page, 'Guards')).not.toHaveAttribute('hidden');

  await page.locator('doc-mindmap [data-part="root"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(card(page, 'Database')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(card(page, 'customers')).toHaveAttribute('hidden', 'until-found');
  await page.keyboard.press('End');
  await expect(card(page, 'Apps')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card(page, 'Shop')).not.toHaveAttribute('hidden');

  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(card(page, 'authenticateVendor')).not.toHaveAttribute('hidden');
  expect(errors).toEqual([]);
});

test('pans with a drag on the background and zooms with Ctrl+wheel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const map = page.locator('doc-mindmap');
  const read = (name: string) =>
    map.evaluate(
      (element, property) => (element as HTMLElement).style.getPropertyValue(property),
      name,
    );

  const box = await map.boundingBox();
  if (!box) throw new Error('the map has no box');
  const x = box.x + box.width - 40;
  const y = box.y + box.height - 30;
  const before = Number.parseFloat(await read('--doc-mm-pan-x'));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y, { steps: 6 });
  await page.mouse.up();
  expect(Number.parseFloat(await read('--doc-mm-pan-x'))).toBeCloseTo(before - 120, 0);

  const zoom = Number.parseFloat(await read('--doc-mm-zoom'));
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 300);
  await page.keyboard.up('Control');
  expect(Number.parseFloat(await read('--doc-mm-zoom'))).toBeLessThan(zoom);

  await page.getByRole('button', { name: 'Fit' }).click();
  await expect
    .poll(async () => Number.parseFloat(await read('--doc-mm-zoom')))
    .toBeLessThanOrEqual(1);
});

test('reads as an outline on a phone, with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await open(page);
  const map = page.locator('doc-mindmap');

  await expect.poll(() => map.evaluate((element) => element.matches(':state(outline)'))).toBe(true);
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(card(page, 'authenticateVendor')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('prints every card, open or not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.emulateMedia({ media: 'print' });
  await expect(card(page, 'authenticateVendor')).toBeVisible();
  await expect(page.locator('doc-mindmap [data-part="toolbar"]')).toBeHidden();
});
