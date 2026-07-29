/** Build-time constants replaced by the bundler. See `vite.config.ts`. */
declare const __PLANKIT_VERSION__: string;

/**
 * Version-pinned CDN origin for the published bundles, baked in at build time
 * from the package name and version so it can never drift from either.
 */
declare const __PLANKIT_CDN_BASE__: string;

/**
 * True only in dev builds.
 *
 * why (§11.3): the in-page violation banner is gated on this literal so that
 * Minification dead-code-eliminates the whole reporter from production output.
 */
declare const __PLANKIT_DEV__: boolean;

declare module '*.svelte' {
  import type { Component } from 'svelte';

  const component: Component<Record<string, unknown>>;
  export default component;
}

declare module '*.css' {
  const url: string;
  export default url;
}

/**
 * Prism ships as UMD scripts with no per-file types.
 *
 * `prism-core.js` returns the `Prism` object; every language file is a bare
 * side-effect module that registers a grammar on the global Prism instance —
 * see `src/vendor/prism-manual.ts` for why the load order matters.
 */
declare module 'prismjs/components/prism-core.js' {
  const Prism: {
    languages: Record<string, unknown>;
    highlight(source: string, grammar: unknown, language: string): string;
    manual?: boolean;
  };
  export default Prism;
}

declare module 'prismjs/components/prism-*.js';

/** The Mermaid source module, aliased per build mode in `vite.config.ts`. */
declare module '@mermaid-source' {
  export const MERMAID_VERSION: string;
  export function loadMermaidModule(): Promise<unknown>;
}
