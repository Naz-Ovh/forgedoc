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
  await page.waitForFunction(() => customElements.get('doc-page') !== undefined);
  await page.locator('doc-page[data-doc-up]').first().waitFor();
  await expect(page.locator('doc-figure[type="mermaid"] [data-part="content"] svg')).toBeVisible({
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
  await expect(page.locator('doc-tabs [data-part="strip"]')).toBeHidden();
  await expect(page.locator('doc-collapse > [data-part="body"]').first()).toBeVisible();
  await expect(page.locator('doc-toc [data-part="list"]')).toBeVisible();
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
  await page.locator('doc-toc [data-part="dock"]').click();
  await page.locator('doc-toc [data-part="toggle"]').click();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const box = await page.locator('doc-header').boundingBox();
    if (!box) throw new Error('doc-header has no box');

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

  const rail = await page.locator('doc-toc').boundingBox();
  const docked = await page.locator('doc-header').boundingBox();
  if (!rail || !docked) throw new Error('no box');

  // Clear of the rail entirely — nothing behind it.
  expect(docked.x).toBeGreaterThanOrEqual(rail.x + rail.width);

  // Centred in the space that is left, not in the viewport.
  const leftGap = docked.x - (rail.x + rail.width);
  const rightGap = 1440 - (docked.x + docked.width);
  expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);

  // Floating it puts the column back in the middle of the whole viewport.
  await page.locator('doc-toc [data-part="dock"]').click();
  const floating = await page.locator('doc-header').boundingBox();
  if (!floating) throw new Error('no box');
  expect(Math.abs(floating.x - (1440 - (floating.x + floating.width)))).toBeLessThanOrEqual(2);
});

/** Collapsed, the panel is a corner pill — never a column-width slab (§8.1). */
test('a collapsed contents panel stays the size of its own header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PAGE);
  await ready(page);

  await page.locator('doc-toc [data-part="toggle"]').click();

  const collapsed = await page.locator('doc-toc').boundingBox();
  if (!collapsed) throw new Error('doc-toc has no box');

  // Before the chrome marker was added this measured ~1296px — 90% of the
  // viewport — because the reading-column rule matched the panel.
  expect(collapsed.width).toBeLessThan(280);
  expect(collapsed.height).toBeLessThan(80);
});

/**
 * A rendered diagram is legible in both colour schemes.
 *
 * This is the only place the question can be asked. The jsdom suite resolves
 * neither `light-dark()` nor `color-mix()` nor `rgb(from …)`, so every token
 * there collapses to one fallback and both schemes come out identical — which
 * is how a dark document shipped drawing light node fills under light text
 * while `tests/components/mermaid-theme.test.ts` stayed green.
 *
 * Untagged, so it runs in CI: it measures colour, not pixels.
 */
for (const scheme of SCHEMES) {
  test(`a mermaid diagram is legible in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto(PAGE);
    await ready(page);

    const measured = await page.evaluate(() => {
      const figure = document.querySelector<HTMLElement>('doc-figure[type="mermaid"]');
      if (!figure) throw new Error('the fixture has no mermaid figure');
      const svg = figure.querySelector('svg');
      if (!svg) throw new Error('the mermaid figure did not render');

      const shape = svg.querySelector('.node rect, .node polygon, .node path');
      const label = svg.querySelector('.nodeLabel, .node .label');
      const edge = svg.querySelector('.flowchart-link, .edgePath .path');
      if (!shape || !label || !edge) throw new Error('the diagram has no node, label or edge');

      return {
        page: getComputedStyle(figure).backgroundColor,
        fill: getComputedStyle(shape).fill,
        ink: getComputedStyle(label).color,
        edge: getComputedStyle(edge).stroke,
      };
    });

    const channels = (colour: string): number[] => {
      const match = /(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)/.exec(colour);
      if (!match) throw new Error(`cannot read the colour "${colour}"`);
      const parsed = [match[1], match[2], match[3]].map(Number);
      // `color(srgb …)` is 0–1 per channel; `rgb()` is 0–255.
      return colour.startsWith('color(') ? parsed.map((value) => value * 255) : parsed;
    };

    const luminance = (colour: string): number => {
      const [red = 0, green = 0, blue = 0] = channels(colour).map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };

    const contrast = (a: string, b: string): number => {
      const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
    };

    // The reported bug: the node fill resolved from the light palette while the
    // label resolved from the dark one, so light text sat on a light box.
    expect(
      contrast(measured.ink, measured.fill),
      `node label ${measured.ink} on fill ${measured.fill}`,
    ).toBeGreaterThan(4.5);

    // A node fill is a tint of the page, not a slab of another scheme's palette.
    expect(
      contrast(measured.fill, measured.page),
      `node fill ${measured.fill} against page ${measured.page}`,
    ).toBeLessThan(2);

    // …and it is genuinely the *accent* tint. Both surfaces are near-neutral
    // and both tints are visibly biased toward the accent hue, so a fill that
    // has gone grey means the token stopped resolving and quietly fell back —
    // legible, on-scheme, and no longer the document's colour.
    const [red = 0, green = 0, blue = 0] = channels(measured.fill);
    expect(
      Math.max(red, green, blue) - Math.min(red, green, blue),
      `node fill ${measured.fill} has no accent hue left in it`,
    ).toBeGreaterThan(6);

    // Edges carry meaning. `--doc-border-2`, the original choice, is 1.7:1 here.
    expect(
      contrast(measured.edge, measured.page),
      `edge ${measured.edge} against page ${measured.page}`,
    ).toBeGreaterThan(3);
  });
}
