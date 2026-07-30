/**
 * Mermaid source for the ESM build: a bare, external dynamic import.
 *
 * why a third variant: an npm consumer bundling `forgedoc` themselves
 * should resolve Mermaid through their own dependency graph, not through a
 * hardcoded CDN URL they cannot audit or pin. It is declared as an optional peer
 * dependency, so a consumer who never writes a `type="mermaid"` figure never
 * installs it.
 */

export const MERMAID_VERSION = '11.16.0';

/** Rejects when the optional peer dependency is absent, which the caller reports. */
export async function loadMermaidModule(): Promise<unknown> {
  const module = (await import('mermaid')) as { default?: unknown };
  return module.default ?? module;
}
