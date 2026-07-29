/**
 * Dev server and test runner only.
 *
 * The shipped artefacts — the three runtime variants, the CLI and the type
 * declarations — are built by `tsdown.config.ts`. Nothing here writes to
 * `dist/`; `vite build` is not part of `npm run build`.
 */

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

import { defines, fromRoot } from './tools/build-env.ts';

/**
 * MUST (§13.1): real Chromium. jsdom and happy-dom implement neither
 * ElementInternals, CustomStateSet, nor the CSS Custom Highlight API, all of
 * which are load-bearing here, so a green suite under either would be
 * meaningless.
 */
const browserProject: ViteUserConfig['test'] = {
  name: 'browser',
  include: ['tests/components/**/*.test.ts', 'tests/browser/**/*.test.ts'],
  setupFiles: [fromRoot('tests/setup.ts')],
  browser: {
    enabled: true,
    provider: playwright(),
    headless: true,
    screenshotFailures: false,
    instances: [{ browser: 'chromium' }],
  },
};

/**
 * why (§11.2): the validator parses raw HTML with parse5 and MUST NOT import the
 * browser runtime, so it is tested outside the browser.
 */
const nodeProject: ViteUserConfig['test'] = {
  name: 'node',
  environment: 'node',
  include: ['tests/node/**/*.test.ts'],
};

export default defineConfig(
  (): ViteUserConfig => ({
    plugins: [svelte()],

    // `true`: the dev server and the tests both want the in-page violation
    // banner (§11.3). The shipped builds pass `false` so it is eliminated.
    define: defines(true),

    resolve: {
      alias: {
        // why the bundled variant rather than the cdn one (§4.2): the QA page and
        // the visual regression suite must render Mermaid diagrams with no
        // network. `tsconfig.json` maps this specifier to the cdn variant so
        // `tsc` has something to typecheck; the build picks one per variant.
        '@mermaid-source': fromRoot('src/vendor/mermaid-source.bundled.ts'),
      },
    },

    server: {
      open: '/tests/fixtures/kitchen-sink.html',
    },

    test: {
      projects: [
        { extends: true, test: browserProject },
        { extends: true, test: nodeProject },
      ],
    },
  }),
);
