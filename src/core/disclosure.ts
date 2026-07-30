/**
 * Showing and hiding author content without ever moving it.
 *
 * why this is not `<details>`/`<summary>` (§8.4, flagged in docs/DECISIONS.md):
 * `<details>` requires the collapsible content to be *inside* it, which means
 * moving every author node into a generated element — the one thing §2.2
 * forbids. The three things `<details>` would have given us are replaced here:
 *
 *   · keyboard support  → the generated summary is a real `<button>`
 *   · find-in-page      → `hidden="until-found"` plus the `beforematch` event
 *   · print expansion   → `print.css` force-expands every disclosure (§8.8)
 *
 * Used by `doc-collapse`, `doc-stage` and `doc-tabs` — three occurrences, so
 * extracting it is warranted (§12).
 */

/** Attribute value that keeps content findable by Ctrl+F while hidden. */
const UNTIL_FOUND = 'until-found';

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
