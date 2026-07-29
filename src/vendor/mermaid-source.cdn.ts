/**
 * Mermaid source for the CDN build: fetched lazily, only when a document
 * actually contains a `type="mermaid"` figure.
 *
 * MUST (§16.5): the version is pinned exactly. A floating major would eventually
 * break diagram rendering in plans that were published and signed off months
 * earlier — the worst kind of regression, because nobody is watching for it.
 */

export const MERMAID_VERSION = '11.16.0';

const CDN_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;

/** Load Mermaid over the network. Rejects offline, which the caller reports. */
export async function loadMermaidModule(): Promise<unknown> {
  const module = (await import(/* @vite-ignore */ CDN_URL)) as { default?: unknown };
  return module.default ?? module;
}
