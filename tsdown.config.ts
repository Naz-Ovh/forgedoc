/**
 * The shipped artefacts: three runtime variants, the CLI, and — via
 * `npm run build:types` — the type declarations. Vite is kept for the dev server
 * and the test runner only, and never writes to `dist/`.
 *
 * why three variants (§4.2): Mermaid is ~1 MB. Bundling it into the CDN build
 * punishes every reader; omitting it from the offline build breaks the offline
 * promise. The variants differ by exactly one aliased module —
 * `@mermaid-source` — so the source tree is never forked.
 */

import svelte from 'rollup-plugin-svelte';
import { defineConfig, type UserConfig } from 'tsdown';

import { defines, fromRoot } from './tools/build-env.ts';
import { mermaidSource, productionEnv } from './tools/build-plugins.ts';

/**
 * The .svelte sources deliberately carry no <style> block (§10.1) — panel styles
 * live in styles/components/bucket.css so the `--doc-*` tokens reach them.
 * `emitCss: false` therefore drops nothing; it just keeps Svelte out of the CSS
 * graph entirely.
 *
 * NOTE: `rollup-plugin-svelte` does not read `svelte.config.js` — only
 * `@sveltejs/vite-plugin-svelte` does. A compiler option added there reaches the
 * dev server, the tests and the editor, but *not* what ships. Pass it here too.
 * (`runes: true` is the one option set there today, and it is redundant in both:
 * Svelte 5 infers runes mode from the syntax these components already use.)
 */
const sveltePlugin = svelte({ emitCss: false });

interface Variant {
  readonly name: string;
  readonly outFile: string;
  readonly format: 'iife' | 'es';
  readonly mermaidSource: string;
  /**
   * Mermaid is an *optional peer dependency*, and tsdown externalises
   * peerDependencies by default. The offline build must therefore ask for it back
   * explicitly — without this it silently produces a 157 kB "standalone" bundle
   * with no Mermaid in it, breaking the offline promise (§2.3).
   */
  readonly alwaysBundle: readonly string[];
  readonly neverBundle: readonly string[];
}

const VARIANTS: readonly Variant[] = [
  /** CDN / hosted viewer, and the default `forgedoc build` target. */
  {
    name: 'cdn',
    outFile: 'forgedoc.iife.js',
    format: 'iife',
    mermaidSource: './src/vendor/mermaid-source.cdn.ts',
    alwaysBundle: [],
    neverBundle: [],
  },
  /** Offline `file://` injection. Everything, Mermaid included. */
  {
    name: 'standalone',
    outFile: 'forgedoc.standalone.iife.js',
    format: 'iife',
    mermaidSource: './src/vendor/mermaid-source.bundled.ts',
    alwaysBundle: ['mermaid'],
    neverBundle: [],
  },
  /** npm consumers and tooling. Mermaid stays a bare, external import. */
  {
    name: 'esm',
    outFile: 'forgedoc.js',
    format: 'es',
    mermaidSource: './src/vendor/mermaid-source.external.ts',
    alwaysBundle: [],
    neverBundle: ['mermaid'],
  },
];

const runtimeBuild = (variant: Variant): UserConfig => ({
  name: variant.name,
  entry: [fromRoot('src/index.ts')],
  outDir: fromRoot('dist'),
  format: variant.format,
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  // why: tsdown runs these configs concurrently and they all write into dist/,
  // so no config may clear it. `npm run build` removes dist/ once, up front.
  clean: false,
  dts: false,
  define: defines(false),
  plugins: [
    sveltePlugin,
    productionEnv,
    mermaidSource(variant.name, fromRoot(variant.mermaidSource)),
  ],
  deps: { alwaysBundle: [...variant.alwaysBundle], neverBundle: [...variant.neverBundle] },
  css: {
    // MUST (§4.3): one CSS file, always. Per-component files that shipped
    // separately would break the @layer ordering guarantee. All three variants
    // emit an identical forgedoc.css from the same styles/index.css graph, so the
    // concurrent overwrites are byte-identical and harmless.
    splitting: false,
    fileName: 'forgedoc.css',
    minify: true,
  },
  outputOptions: {
    name: 'ForgeDoc',
    entryFileNames: variant.outFile,
    // IIFE cannot code-split, and the standalone bundle must be one file that
    // opens from `file://` with no network (§2.3).
    ...(variant.format === 'iife' ? { codeSplitting: false } : {}),
  },
});

/**
 * The CLI. `parse5` is a build-time dependency, not a runtime one — bundling it
 * keeps it out of the published package's dependency list, so a browser-only
 * consumer never installs an HTML parser.
 */
const cliBuild: UserConfig = {
  name: 'cli',
  entry: [fromRoot('tools/cli-bin.ts')],
  outDir: fromRoot('dist'),
  format: 'es',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: false,
  dts: false,
  define: defines(false),
  // parse5 and its transitive dependencies must both land in the bundle so the
  // published package lists no runtime dependency at all.
  deps: { onlyBundle: false },
  outputOptions: {
    entryFileNames: 'cli.js',
    banner: '#!/usr/bin/env node',
  },
};

export default defineConfig([cliBuild, ...VARIANTS.map(runtimeBuild)]);
