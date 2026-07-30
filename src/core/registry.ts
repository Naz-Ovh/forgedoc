/**
 * Custom element registration.
 *
 * why a helper rather than 32 bare `customElements.define` calls: the runtime is
 * re-injected on every rebuild and, during iteration, often evaluated twice into
 * the same document. A second `define()` for a name that already exists throws a
 * `NotSupportedError` and takes the rest of the bundle down with it — so the
 * whole document would go blank because you refreshed at the wrong moment.
 */

import type { DocElement } from './base.js';

type DocElementConstructor = CustomElementConstructor & {
  prototype: DocElement;
};

const registered = new Set<string>();

/**
 * Define `tagName`, ignoring a repeat definition.
 *
 * Returns true when this call performed the registration, so `index.ts` can
 * report how much of the vocabulary is live.
 */
export function define(tagName: string, elementConstructor: DocElementConstructor): boolean {
  if (registered.has(tagName)) return false;
  registered.add(tagName);

  if (customElements.get(tagName)) return false;
  customElements.define(tagName, elementConstructor);
  return true;
}

/** Tag names this bundle has registered. */
export function registeredTags(): string[] {
  return [...registered].sort();
}

/**
 * Force any pending upgrades inside `root` to run now.
 *
 * why (§5.2): elements are defined after the document is parsed, so upgrades
 * normally happen once, synchronously, with all children present. `upgrade()`
 * covers the one case that misses — a `doc-page` inserted into an already-live
 * document by tooling or by a test.
 */
export function upgradeSubtree(root: Element): void {
  customElements.upgrade(root);
}
