/**
 * §13.4: the kitchen sink at every breakpoint, in both colour schemes, plus
 * print.
 *
 * The breakpoints are not arbitrary — they are the four the layout rules in §8.1
 * actually branch on: below 1050px (full width, stacked tables, wrapped flow),
 * 1050–1279px (90% width, no TOC rail), 1280px+ (TOC rail), and 2560px+ (the
 * measure may widen).
 *
 * Two kinds of test live here, and the difference decides where each one runs.
 *
 * Tests tagged `@pixel` compare against a recorded PNG. Those baselines are
 * generated, so the repository does not store them: they are reproducible from
 * the source at any time, they are only valid on the machine and font stack
 * that recorded them, and re-recording them writes megabytes of new binaries
 * into history that no reviewer can read in a diff. Run them locally with
 * `npm run test:visual`, which records on first run and compares thereafter.
 *
 * Everything untagged asserts on measured geometry and computed state instead —
 * deterministic, reviewable, and independent of font rendering. That is the half
 * CI runs, via `npm run test:visual:ci`.
 */

import { expect, type Page, test } from '@playwright/test';

const PAGE = '/tests/fixtures/kitchen-sink.html';

const VIEWPORTS = [
  { name: '390', width: 390, height: 1400 },
  { name: '768', width: 768, height: 1400 },
  { name: '1280', width: 1280, height: 1400 },
  { name: '2560', width: 2560, height: 1600 },
] as const;

const SCHEMES = ['light', 'dark'] as const;

/** Wait until every component has upgraded and Mermaid has drawn. */
async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => customElements.get('plan-doc') !== undefined);
  await page.locator('plan-doc[data-plan-up]').first().waitFor();
  await expect(page.locator('plan-figure[type="mermaid"] [data-part="content"] svg')).toBeVisible({
    timeout: 20_000,
  });
  // Fonts settle after layout; without this the first screenshot of a run
  // differs from every later one.
  await page.evaluate(() => document.fonts.ready);
}

for (const scheme of SCHEMES) {
  for (const viewport of VIEWPORTS) {
    test(`kitchen sink · ${viewport.name}px · ${scheme}`, { tag: '@pixel' }, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(PAGE);
      await ready(page);

      await expect(page).toHaveScreenshot(`kitchen-sink-${viewport.name}-${scheme}.png`, {
        fullPage: true,
      });
    });
  }
}

/**
 * The print rules themselves, with no picture involved.
 *
 * These are the assertions that actually encode §8.8 — a screenshot would catch
 * the same regressions, but only on a machine holding a matching baseline.
 */
test('kitchen sink · print hides chrome and expands disclosures', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(PAGE);
  await ready(page);

  // MUST (§8.8): bucket hidden, disclosures expanded, tabs flattened.
  await page.emulateMedia({ media: 'print' });

  await expect(page.locator('[data-part="bucket-trigger"]')).toBeHidden();
  await expect(page.locator('plan-tabs [data-part="strip"]')).toBeHidden();
  await expect(page.locator('plan-collapse > [data-part="body"]').first()).toBeVisible();
  await expect(page.locator('plan-toc [data-part="list"]')).toBeVisible();
});

test('kitchen sink · print', { tag: '@pixel' }, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(PAGE);
  await ready(page);
  await page.emulateMedia({ media: 'print' });

  await expect(page).toHaveScreenshot('kitchen-sink-print.png', { fullPage: true });
});

test('the reading column is centred at every width', async ({ page }) => {
  await page.goto(PAGE);
  await ready(page);

  // The fixture ships docked, which is the point of the next test. Float it so
  // this one measures the plain centring rule.
  await page.locator('plan-toc [data-part="dock"]').click();
  await page.locator('plan-toc [data-part="toggle"]').click();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const box = await page.locator('plan-header').boundingBox();
    if (!box) throw new Error('plan-header has no box');

    const leftGap = box.x;
    const rightGap = viewport.width - (box.x + box.width);

    // MUST (§8.1): never left-hugging on ultrawide.
    expect(Math.abs(leftGap - rightGap), `off-centre at ${viewport.width}px`).toBeLessThanOrEqual(
      2,
    );
  }
});

/**
 * Docking pushes the content rather than covering it, and the column re-centres
 * in what is left.
 *
 * This is the whole reason the docked mode exists: a floating panel over a
 * document is fine for a glance and useless for reading alongside.
 */
test('a docked contents panel pushes the column and re-centres it', async ({ page }) => {
  // The push is animated, so measure with the animation off. That is also the
  // only coverage the `prefers-reduced-motion` rule gets.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PAGE);
  await ready(page);

  const rail = await page.locator('plan-toc').boundingBox();
  const docked = await page.locator('plan-header').boundingBox();
  if (!rail || !docked) throw new Error('no box');

  // Clear of the rail entirely — nothing behind it.
  expect(docked.x).toBeGreaterThanOrEqual(rail.x + rail.width);

  // Centred in the space that is left, not in the viewport.
  const leftGap = docked.x - (rail.x + rail.width);
  const rightGap = 1440 - (docked.x + docked.width);
  expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);

  // Floating it puts the column back in the middle of the whole viewport.
  await page.locator('plan-toc [data-part="dock"]').click();
  const floating = await page.locator('plan-header').boundingBox();
  if (!floating) throw new Error('no box');
  expect(Math.abs(floating.x - (1440 - (floating.x + floating.width)))).toBeLessThanOrEqual(2);
});

/** Collapsed, the panel is a corner pill — never a column-width slab (§8.1). */
test('a collapsed contents panel stays the size of its own header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PAGE);
  await ready(page);

  await page.locator('plan-toc [data-part="toggle"]').click();

  const collapsed = await page.locator('plan-toc').boundingBox();
  if (!collapsed) throw new Error('plan-toc has no box');

  // Before the chrome marker was added this measured ~1296px — 90% of the
  // viewport — because the reading-column rule matched the panel.
  expect(collapsed.width).toBeLessThan(280);
  expect(collapsed.height).toBeLessThan(80);
});
