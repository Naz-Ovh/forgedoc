/**
 * Rolldown plugins for the shipped builds. Kept out of `tsdown.config.ts` so
 * that config reads as a declaration of the four artefacts rather than as
 * plugin source.
 *
 * Both exist because a `resolveId` hook is the only lever that runs early
 * enough — see the reasoning at each one.
 */

/** The shape rolldown needs; narrower than importing its plugin type. */
interface ResolvePlugin {
  readonly name: string;
  resolveId(id: string): string | null;
  load?(id: string): string | null;
}

/**
 * Point `@mermaid-source` at one variant's module (§4.2).
 *
 * why a plugin rather than tsdown's `alias`: `tsconfig.json` already maps this
 * specifier to the cdn variant so `tsc` has something to typecheck, and tsdown
 * resolves tsconfig `paths` ahead of its own `alias` option. A `resolveId` hook
 * runs before both. Getting this wrong is silent — every variant builds happily
 * and all three ship the cdn source.
 */
export const mermaidSource = (variantName: string, modulePath: string): ResolvePlugin => ({
  // MUST be unique per variant: rolldown merges plugins that share a name, so a
  // single shared name silently gives every variant whichever instance sorts
  // first — three byte-identical bundles that all ship the cdn source.
  name: `forgedoc:mermaid-source:${variantName}`,
  resolveId: (id) => (id === '@mermaid-source' ? modulePath : null),
});

const ENV = '\0forgedoc:env:';

/**
 * Resolve Svelte's environment flags to literals so its dev code can be
 * eliminated. Worth 12.1 kB raw / 3.9 kB gzip — about 7% of the CDN bundle.
 *
 * Svelte's runtime reads `DEV` and `BROWSER` from `esm-env`, which answers via
 * export conditions. Nobody here sends one, so `esm-env` falls back to reading
 * `globalThis.process?.env?.NODE_ENV` — a *runtime* check. The value is falsy in
 * a browser, so the dev code never ran; but a runtime check is not statically
 * false, so no `if (DEV)` branch was ever dead, and the warnings, tracing and
 * ownership validation shipped to every reader.
 *
 * why a plugin rather than the `production` export condition: two reasons.
 * `resolve.conditionNames` has no effect here — measured, byte-identical with
 * `[production]` and with `[browser, production, import, default]`. And
 * `esm-env`'s map for `./browser` sends `production` to `false.js`, winning on
 * `browser` only because that key sorts first; any build where the `browser`
 * condition went inactive would resolve `BROWSER` to false, eliminate Svelte's
 * client mount, and make the feedback panel vanish with no error and a
 * *smaller* bundle. Pinning both literals makes that unreachable.
 *
 * A single shared instance is deliberate: the uniqueness rule above applies to
 * plugins whose behaviour differs per variant, and this one is identical for all
 * of them.
 *
 * If the build ever moves back to Vite, delete this. Vite's default client
 * conditions are `['module', 'browser', 'development|production']`, which does
 * the same thing automatically — a `vite build` of this same source lands within
 * 90 bytes of the output this plugin produces.
 */
export const productionEnv: ResolvePlugin = {
  name: 'forgedoc:production-env',
  resolveId: (id) => {
    if (id === 'esm-env/development') return `${ENV}false`;
    if (id === 'esm-env/browser') return `${ENV}true`;
    return null;
  },
  load: (id) => {
    if (id === `${ENV}false`) return 'export default false;';
    if (id === `${ENV}true`) return 'export default true;';
    return null;
  },
};
