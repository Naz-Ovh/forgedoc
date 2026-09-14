/**
 * End-to-end behaviour, in a real browser, against the artefacts as delivered.
 *
 * This suite drives the two delivery modes — a `file://` offline build and a
 * CDN-linked document — and asserts what they *do*: elements upgrade, answers
 * persist, the feedback block round-trips, the offline build reaches no network.
 *
 * Appearance is deliberately out of scope. There are no screenshots and no
 * computed-style assertions here: styling changes often and by intent, and a
 * test that fails when a colour or a margin moves is noise.
 */

import { defineConfig, devices } from '@playwright/test';

/*
 * The dev-server port, overridable.
 *
 * why it is not just 5173: that is Vite's default, so any other project with a
 * dev server running holds it, and `--strictPort` then fails the whole visual
 * run with "port already in use" rather than falling back. `reuseExistingServer`
 * does not save it either — the squatter answers, just with a 404 for our
 * fixture, so Playwright decides the server is not ours and tries to start one.
 * `FORGEDOC_TEST_PORT=5199 npm run test:visual` gets out of the way.
 */
const PORT = Number(process.env.FORGEDOC_TEST_PORT ?? 5173);
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/visual',
  outputDir: './tests/visual/.output',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: ORIGIN,
    ...devices['Desktop Chrome'],
  },

  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `${ORIGIN}/tests/fixtures/kitchen-sink.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
