/**
 * Library builds: the three runtime variants, the CLI, and the type
 * declarations. Vite is kept for the dev server and the test runner only.
 *
 * why (§4.2): Mermaid is ~1 MB. Bundling it into the CDN build punishes every
 * reader; omitting it from the offline build breaks the offline promise. The
 * three variants below differ by exactly one aliased module — `@mermaid-source`
 * — so the source tree is never forked.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import svelte from 'rollup-plugin-svelte';
import { defineConfig, type UserConfig } from 'tsdown';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

const here = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const define = {
  __PLANKIT_VERSION__: JSON.stringify(packageJson.version),
  // why: the CLI's default flavour writes this URL into every document it
  // builds, so it must track the *published* name and version rather than being
  // typed anywhere. Pinned to the exact version — see the MUST in inject.ts.
  __PLANKIT_CDN_BASE__: JSON.stringify(
    `https://cdn.jsdelivr.net/npm/${packageJson.name}@${packageJson.version}/dist`,
  ),
  // why (§11.3): the in-page violation banner must be dead-code-eliminated from
  // production output, so it is gated on a literal the bundler replaces before
  // minification.
  __PLANKIT_DEV__: 'false',
};

/**
 * The .svelte sources deliberately carry no <style> block (§10.1) — panel
 * styles live in styles/components/bucket.css so the `--plan-*` tokens reach
 * them. `emitCss: false` therefore drops nothing; it just keeps Svelte out of
 * the CSS graph entirely.
 */
const sveltePlugin = svelte({ emitCss: false });

/**
 * Point `@mermaid-source` at one variant's module.
 *
 * why a plugin rather than tsdown's `alias`: `tsconfig.json` already maps this
 * specifier to the cdn variant so that `tsc` has something to typecheck, and
 * tsdown resolves tsconfig `paths` ahead of its own `alias` option. A
 * `resolveId` hook runs before both. Getting this wrong is silent — every
 * variant builds happily, and all three ship the cdn source.
 */
const mermaidSource = (variantName: string, modulePath: string) => ({
  // MUST be unique per variant: rolldown merges plugins that share a name, so a
  // single shared name silently gives every variant whichever instance sorts
  // first — three byte-identical bundles that all ship the cdn source.
  name: `plankit:mermaid-source:${variantName}`,
  resolveId(id: string): string | null {
    return id === '@mermaid-source' ? modulePath : null;
  },
});

interface Variant {
  readonly name: string;
  readonly outFile: string;
  readonly format: 'iife' | 'es';
  readonly mermaidSource: string;
  /**
   * Mermaid is an *optional peer dependency*, and tsdown externalises
   * peerDependencies by default. The offline build must therefore ask for it
   * back explicitly — without this it silently produces a 157 kB "standalone"
   * bundle with no Mermaid in it, breaking the offline promise (§2.3).
   */
  readonly alwaysBundle: readonly string[];
  readonly neverBundle: readonly string[];
}

const VARIANTS: readonly Variant[] = [
  /** CDN / hosted viewer. Core + Prism, Mermaid lazily fetched from jsDelivr. */
  {
    name: 'cdn',
    outFile: 'plankit.iife.js',
    format: 'iife',
    mermaidSource: './src/vendor/mermaid-source.cdn.ts',
    alwaysBundle: [],
    neverBundle: [],
  },
  /** Offline `file://` injection. Everything, Mermaid included. */
  {
    name: 'standalone',
    outFile: 'plankit.standalone.iife.js',
    format: 'iife',
    mermaidSource: './src/vendor/mermaid-source.bundled.ts',
    alwaysBundle: ['mermaid'],
    neverBundle: [],
  },
  /** npm consumers and tooling. Mermaid stays a bare, external import. */
  {
    name: 'esm',
    outFile: 'plankit.js',
    format: 'es',
    mermaidSource: './src/vendor/mermaid-source.external.ts',
    alwaysBundle: [],
    neverBundle: ['mermaid'],
  },
];

const runtimeBuild = (variant: Variant): UserConfig => ({
  name: variant.name,
  entry: [here('./src/index.ts')],
  outDir: here('./dist'),
  format: variant.format,
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  // why: tsdown runs these configs concurrently and they all write into dist/,
  // so no config may clear it. `npm run build` removes dist/ once, up front.
  clean: false,
  dts: false,
  define,
  plugins: [sveltePlugin, mermaidSource(variant.name, here(variant.mermaidSource))],
  deps: { alwaysBundle: [...variant.alwaysBundle], neverBundle: [...variant.neverBundle] },
  css: {
    // MUST (§4.3): one CSS file, always. Per-component files that shipped
    // separately would break the @layer ordering guarantee.
    splitting: false,
    fileName: 'plankit.css',
    minify: true,
  },
  outputOptions: {
    name: 'PlanKit',
    entryFileNames: variant.outFile,
    // IIFE cannot code-split, and the standalone bundle must be one file that
    // opens from `file://` with no network (§2.3).
    ...(variant.format === 'iife' ? { codeSplitting: false } : {}),
  },
  // All three emit an identical plankit.css from the same styles/index.css
  // graph, so the concurrent overwrites are byte-identical and harmless.
});

export default defineConfig([
  /**
   * The CLI. `parse5` is a build-time dependency, not a runtime one — bundling
   * it keeps it out of the published package's dependency list, so a
   * browser-only consumer never installs an HTML parser.
   */
  {
    name: 'cli',
    entry: [here('./tools/cli-bin.ts')],
    outDir: here('./dist'),
    format: 'es',
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    clean: false,
    dts: false,
    define,
    // parse5 and its transitive  must both land in the bundle so the
    // published package lists no runtime dependency at all.
    deps: { onlyBundle: false },
    outputOptions: {
      entryFileNames: 'cli.js',
      banner: '#!/usr/bin/env node',
    },
  },
  ...VARIANTS.map(runtimeBuild),
]);
