/**
 * `<doc-term href="…">` — an inline technical term, hyperlinked.
 *
 * why a tag rather than a plain `<a>` (§8.3): the source skill mandates
 * hyperlinking technical terms. Making it a tag lets the validator reject one
 * without an `href`, and lets the first mention be styled differently from
 * every repeat — the runtime tracks occurrences per document.
 */

import { DocElement } from '../core/base.js';

/** Terms already seen in each document, so repeats can be styled down. */
const seenTermsByDocument = new WeakMap<Element, Set<string>>();

export class DocTerm extends DocElement {
  protected enhance(): void {
    const href = this.attr('href');
    if (!href) return;

    this.#markFirstMention();
    this.#wireLink(href);
  }

  #markFirstMention(): void {
    const docPage = this.docPage();
    if (!docPage) return;

    const key = (this.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    let seen = seenTermsByDocument.get(docPage);
    if (!seen) {
      seen = new Set<string>();
      seenTermsByDocument.set(docPage, seen);
    }

    const isFirst = !seen.has(key);
    seen.add(key);
    this.setState('first-mention', isFirst);
  }

  /**
   * Make the term behave like a link without wrapping the author's text in an
   * `<a>` — wrapping would mean moving author content (§2.2).
   */
  #wireLink(href: string): void {
    this.internals.role = 'link';
    this.setAttribute('tabindex', '0');
    this.dataset.href = href;

    this.on(this, 'click', () => this.#open(href));
    this.on(this, 'keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.#open(href);
    });
  }

  #open(href: string): void {
    window.open(href, '_blank', 'noopener,noreferrer');
  }
}
