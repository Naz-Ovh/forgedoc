/**
 * `<doc-ref to="sec-data-model">` — an inline cross-reference.
 *
 * why (§8.3): once numbering is automatic, a hardcoded "see Stage 5" in prose is
 * a latent bug the moment stages shift. This resolves to the live number at
 * mount, and the validator errors on a `to` that does not resolve — so a broken
 * reference fails the build rather than misleading a reader.
 */

import { DocElement } from '../core/base.js';
import { indexFor } from '../core/numbering.js';

export class DocRef extends DocElement {
  protected enhance(): void {
    const target = this.attr('to');
    if (!target) return;

    const label = this.#labelFor(target);
    this.textContent = label;
    this.internals.role = 'link';
    this.setAttribute('tabindex', '0');

    this.on(this, 'click', () => this.#jumpTo(target));
    this.on(this, 'keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.#jumpTo(target);
    });
  }

  /** `Section 3.1`, `Stage 2`, `Question 4`, or the target's own title. */
  #labelFor(targetId: string): string {
    const docPage = this.docPage();
    const target = docPage?.querySelector(`#${CSS.escape(targetId)}`);
    if (!docPage || !(target instanceof HTMLElement)) return `[missing: ${targetId}]`;

    switch (target.tagName.toLowerCase()) {
      case 'doc-section': {
        const entry = indexFor(docPage).outline.find((row) => row.element === target);
        return entry ? `Section ${entry.number}` : 'Section';
      }
      case 'doc-stage':
        return `Stage ${target.dataset.number ?? '?'}`;
      case 'doc-choice':
        return `Question ${target.dataset.number ?? '?'}`;
      default:
        return target.getAttribute('title') ?? targetId;
    }
  }

  #jumpTo(targetId: string): void {
    const target = document.getElementById(targetId);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // why set the hash too: it makes the jump a real navigation the reader can
    // undo with the back button, and it survives a copy of the URL.
    history.replaceState(null, '', `#${targetId}`);
  }
}
