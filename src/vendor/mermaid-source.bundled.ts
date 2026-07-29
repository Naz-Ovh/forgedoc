/**
 * Mermaid source for the standalone build: compiled straight into the bundle.
 *
 * why (§4.2): the offline document has no network. Mermaid is ~1 MB, which is
 * why the CDN build does not carry it — but omitting it here would break the
 * offline promise, and the offline build is the one that must never break
 * (§2.3).
 */

import mermaid from 'mermaid';

export const MERMAID_VERSION = '11.16.0';

/** Already in the bundle; the promise resolves immediately. */
export async function loadMermaidModule(): Promise<unknown> {
  return mermaid;
}
