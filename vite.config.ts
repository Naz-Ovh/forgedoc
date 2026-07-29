/**
 * Dev server and test runner only.
 *
 * The shipped artefacts — the three runtime variants, the CLI and the type
 * declarations — are built by `tsdown.config.ts`. Nothing here writes to
 * `dist/`; `vite build` is not part of `npm run build`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

const here = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig((): ViteUserConfig => {
  return {
    plugins: [svelte()],

    define: {
      __PLANKIT_VERSION__: JSON.stringify(packageJson.version),
      // MUST stay in step with tsdown.config.ts. The CLI tests assert that a
      // built document pins an exact version, and they run this source rather
      // than the bundle — so a define that exists only in the real build would
      // leave them checking the fallback string instead.
      __PLANKIT_CDN_BASE__: JSON.stringify(
        `https://cdn.jsdelivr.net/npm/${packageJson.name}@${packageJson.version}/dist`,
      ),
      // why (§11.3): the in-page violation banner is gated on this literal so
      // production output can dead-code-eliminate it. Dev and test want it on.
      __PLANKIT_DEV__: JSON.stringify(true),
    },

    resolve: {
      alias: {
        // why the bundled variant rather than the cdn one (§4.2): the QA page
        // and the visual regression suite must render Mermaid diagrams with no
        // network. `tsconfig.json` maps this specifier to the cdn variant so
        // `tsc` has something to typecheck; the build picks per variant.
        '@mermaid-source': here('./src/vendor/mermaid-source.bundled.ts'),
      },
    },

    server: {
      open: '/tests/fixtures/kitchen-sink.html',
    },

    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'browser',
            include: ['tests/components/**/*.test.ts', 'tests/browser/**/*.test.ts'],
            setupFiles: [here('./tests/setup.ts')],
            // MUST (§13.1): real Chromium. jsdom and happy-dom implement neither
            // ElementInternals, CustomStateSet, nor the CSS Custom Highlight API,
            // all of which are load-bearing here.
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              screenshotFailures: false,
              instances: [{ browser: 'chromium' }],
            },
          },
        },
        {
          extends: true,
          test: {
            name: 'node',
            // why (§11.2): the validator parses raw HTML with parse5 and MUST
            // NOT import the browser runtime, so it is tested outside the browser.
            environment: 'node',
            include: ['tests/node/**/*.test.ts'],
          },
        },
      ],
    },
  };
});
