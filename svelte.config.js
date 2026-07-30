/**
 * Svelte configuration — used only by the bucket panel (§10).
 *
 * MUST NOT set `customElement: true`. In custom element mode Svelte inlines
 * component styles as a JavaScript string rather than emitting a CSS file, which
 * would put the panel's styles outside `@layer doc.components` and out of reach
 * of both the `--doc-*` tokens and the author's escape hatch (§10.1).
 */

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
  compilerOptions: {
    runes: true,
  },
};
