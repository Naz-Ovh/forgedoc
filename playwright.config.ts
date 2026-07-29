/**
 * Visual regression (§13.4).
 *
 * Screenshots of the kitchen sink at 390 / 768 / 1280 / 2560px, in light and
 * dark, plus a print snapshot. Small enough to be worth it, and it is the only
 * thing that catches "the accent preset broke callout borders".
 *
 * Kept out of `npm test` and run with `npm run test:visual`, because pixel
 * baselines are only meaningful on a machine with the same fonts. CI runs it in
 * a pinned container; see `.github/workflows/ci.yml`.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  outputDir: './tests/visual/.output',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
  },

  expect: {
    toHaveScreenshot: {
      // Font hinting differs by a hair between machines; anything larger than
      // this is a real layout change, not a rendering difference.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173/tests/fixtures/kitchen-sink.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
