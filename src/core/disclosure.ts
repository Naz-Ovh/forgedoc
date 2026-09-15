/**
 * Showing and hiding author content.
 *
 * why this is not `<details>`/`<summary>` (§8.4, flagged in docs/DECISIONS.md):
 * `<details>` owns its own summary styling and its own open/close semantics,
 * neither of which survives a theme. The three things it would have given us
 * are replaced here:
 *
 *   · keyboard support  → the generated summary is a real `<button>`
 *   · find-in-page      → `hidden="until-found"` plus the `beforematch` event
 *   · print expansion   → `print.css` force-expands every disclosure (§8.8)
 *
 * Used by `doc-collapse`, `doc-stage` and `doc-tabs` — three occurrences, so
 * extracting it is warranted (§12).
 */

import { authorChildren, createPart } from './parts.js';

/** Attribute value that keeps content findable by Ctrl+F while hidden. */
const UNTIL_FOUND = 'until-found';

/**
 * Give a disclosure one element holding everything it has to hide.
 *
 * A disclosure is a trigger and a content region, and this builds the content
 * region. Everything the author wrote goes in it, whatever they wrote:
 *
 *     <doc-collapse title="…">          <doc-collapse title="…">
 *       Bare text with <code>x</code>.    <button data-part="summary">…</button>
 *     </doc-collapse>                     <div data-part="body">
 *                                           Bare text with <code>x</code>.
 *                                         </div>
 *                                       </doc-collapse>
 *
 * why the runtime builds it rather than asking the author for a `<p>`: closing
 * is `hidden="until-found"` on the content, that is an attribute, and a text
 * node has none — so a panel written as a bare sentence toggled its chevron
 * while the words stayed on screen. It also gives the region a single box, so
 * the inset and the rule under the trigger are drawn once instead of once per
 * paragraph.
 *
 * why that is allowed here (§2.2): the rule forbids reparenting because moving
 * a text node invalidates live `Range`s, and highlight restore runs right after
 * mount. Neither applies. This runs inside `enhance()`, before any `Range`
 * exists, and a highlight is anchored by character offset into the anchor's
 * `textContent` (`SerializedRange`), which a wrapper does not change by one
 * character. The alternative — hiding loose prose with `visibility` or a clip —
 * takes it away from Ctrl+F with nothing to put it back, which is a worse trade
 * than a container the reader can never observe.
 */
export function ensureContentElement(owner: Element, name: string): void {
  const existing = authorChildren(owner).find((child) => child.dataset.docWrap !== undefined);
  if (existing) return;

  const content = createPart(name, 'div');
  // Not chrome: it stands in for the author's body, so every `[data-part]` rule
  // and every hide/reveal path treats it exactly as it would their own `<p>`.
  delete content.dataset.docChrome;
  content.dataset.docWrap = '';

  // Author content is one contiguous run between the chrome around it, so the
  // container goes where that run starts and the run moves into it in order.
  const nodes = Array.from(owner.childNodes).filter(
    (node) => !(node instanceof HTMLElement && node.dataset.docChrome !== undefined),
  );
  const first = nodes[0];
  if (!first) return;

  owner.insertBefore(content, first);
  content.append(...nodes);
}

/**
 * Hide or show every author child of `owner`.
 *
 * Chrome the runtime appended (the summary button, the number badge) is left
 * visible, so the disclosure still has something to click on when closed.
 */
export function setContentHidden(owner: Element, hidden: boolean): void {
  for (const child of Array.from(owner.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.dataset.docChrome !== undefined) continue;

    if (!hidden) {
      child.removeAttribute('hidden');
      continue;
    }
    // Browsers without `until-found` treat any value as plain `hidden`, which is
    // a correct if less capable fallback.
    child.setAttribute('hidden', UNTIL_FOUND);
  }
}

/**
 * Reveal the disclosure when the browser's find-in-page lands inside it.
 *
 * MUST (acceptance 4): Ctrl+F finds text inside every component, including
 * collapsed content, wherever the browser supports it.
 */
export function revealOnFindInPage(owner: Element, reveal: () => void): void {
  owner.addEventListener('beforematch', reveal);
}

/** True when at least one author child is currently hidden. */
export function isContentHidden(owner: Element): boolean {
  for (const child of Array.from(owner.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.dataset.docChrome !== undefined) continue;
    if (child.hasAttribute('hidden')) return true;
  }
  return false;
}
