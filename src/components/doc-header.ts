/**
 * `<doc-header>` — the document title block.
 *
 * ```html
 * <doc-header kicker="Plan · Universabile vendor dashboard">
 *   Vendor orders experience
 *   <p slot="lede">Vendors get told the moment a new order lands…</p>
 * </doc-header>
 * ```
 *
 * Note: `slot` here is a plain attribute used as a selector hook, not a shadow
 * slot (§8.1). The node is styled where it stands and never moved.
 */

import { DocElement } from '../core/base.js';
import { createPart } from '../core/parts.js';

export class DocHeader extends DocElement {
  protected enhance(): void {
    this.#prependKicker();
    this.#markLede();
    this.#markTitleElement();
    this.#publishTitleText();
  }

  #prependKicker(): void {
    const kicker = this.attr('kicker');
    if (!kicker) return;

    // why prepend rather than wrap: appending new elements is allowed, moving
    // the author's title text node into a generated wrapper is not (§2.2).
    this.prepend(createPart('kicker', 'div', { text: kicker }));
  }

  #markLede(): void {
    const lede = this.querySelector<HTMLElement>('[slot="lede"]');
    if (lede) lede.dataset.part = 'lede';
  }

  /**
   * Expose a `title` part when — and only when — the author wrapped the title in
   * an element of their own.
   *
   * why conditional (§2.2): in the recommended form the title is a bare text
   * node beside the lede. There is no element to name, and creating one would
   * mean moving author content. `doc-header` carries the title typography
   * itself in that case; see `styles/components/header.css`.
   */
  #markTitleElement(): void {
    for (const child of Array.from(this.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.dataset.docChrome !== undefined) continue;
      if (child.getAttribute('slot') === 'lede') continue;

      child.dataset.part = 'title';
      return;
    }
  }

  /**
   * Publish the title text for `doc-page` to use as the document's ARIA label.
   *
   * Reads only the direct text nodes, so the lede paragraph does not leak into
   * the title.
   */
  #publishTitleText(): void {
    const titlePart = this.findPart('title');
    const text = titlePart ? titlePart.textContent : this.#directTextContent();
    const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
    if (trimmed) this.dataset.title = trimmed;
  }

  #directTextContent(): string {
    return Array.from(this.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ');
  }
}
