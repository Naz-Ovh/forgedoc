/**
 * `<doc-file-group title="Database" path="packages/db" count="~9 files" open>`
 * — one collapsible area of a `doc-files` stack.
 *
 * The header is a generated `<button>`: title, optional path chip, a muted
 * count on the right and a +/− toggle. The `doc-file` children are the body
 * and are hidden in place with `hidden="until-found"`, so Ctrl+F still finds a
 * path in a closed group (see `core/disclosure.ts`). No wrapper is needed —
 * every author child is a `doc-file`, and each hides itself.
 *
 * Parts: `summary`, `summary-title`, `summary-path`, `count`, `toggle`.
 */

import { DocElement } from '../core/base.js';
import { isContentHidden, revealOnFindInPage, setContentHidden } from '../core/disclosure.js';
import { createPart } from '../core/parts.js';

export class DocFileGroup extends DocElement {
  protected enhance(): void {
    this.internals.role = 'list';
    this.#prependSummary();
    this.setOpen(this.flag('open'));
    revealOnFindInPage(this, () => this.setOpen(true));
  }

  #prependSummary(): void {
    if (this.findPart('summary')) return;

    const summary = createPart('summary', 'button');
    summary.setAttribute('type', 'button');
    summary.append(createPart('summary-title', 'span', { text: this.attr('title') }));

    const path = this.attr('path');
    if (path) {
      summary.append(document.createTextNode(' — '));
      summary.append(createPart('summary-path', 'code', { text: path }));
    }

    summary.append(createPart('count', 'span', { text: this.attr('count', this.#fileCount()) }));
    const toggle = createPart('toggle', 'span');
    toggle.setAttribute('aria-hidden', 'true');
    summary.append(toggle);

    this.on(summary, 'click', () => this.setOpen(!this.isOpen));
    this.prepend(summary);
  }

  /** `3 files`, from the entries the author wrote, when no `count` is given. */
  #fileCount(): string {
    const files = this.querySelectorAll(':scope > doc-file').length;
    return `${files} ${files === 1 ? 'file' : 'files'}`;
  }

  get isOpen(): boolean {
    return !isContentHidden(this);
  }

  /** Open or close the group, updating its state, toggle glyph and ARIA. */
  setOpen(open: boolean): void {
    setContentHidden(this, !open);
    this.setState('open', open);
    this.findPart('summary')?.setAttribute('aria-expanded', String(open));
    const toggle = this.findPart('toggle');
    if (toggle) toggle.textContent = open ? '−' : '+';
  }
}
