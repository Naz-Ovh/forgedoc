/**
 * `<plan-collapse title="…" open sticky>` — a generic disclosure.
 *
 * Distinct from `plan-stage`, which is a numbered sequence with a
 * current-position marker rather than a plain disclosure (§8.5).
 *
 * `sticky` persists the reader's choice in the store; without it the initial
 * `open` attribute wins on every load.
 */

import { PlanElement } from '../core/base.js';
import { isContentHidden, revealOnFindInPage, setContentHidden } from '../core/disclosure.js';
import { createPart, nameAuthorContent } from '../core/parts.js';
import { collapseId } from '../core/slug.js';

export class PlanCollapse extends PlanElement {
  protected enhance(): void {
    if (!this.id) this.id = collapseId(this.attr('title'));

    nameAuthorContent(this, 'body');
    this.#prependSummary();
    this.setOpen(this.#initialOpenState());

    revealOnFindInPage(this, () => this.setOpen(true));
  }

  /** Open on load: the reader's stored choice when `sticky`, else the attribute. */
  #initialOpenState(): boolean {
    if (!this.flag('sticky')) return this.flag('open');

    const stored = this.store()?.get('collapse')[this.id];
    return stored ?? this.flag('open');
  }

  #prependSummary(): void {
    if (this.findPart('summary')) return;

    const summary = createPart('summary', 'button');
    summary.setAttribute('type', 'button');

    const chevron = createPart('chevron', 'span', { text: '▸' });
    chevron.setAttribute('aria-hidden', 'true');
    summary.append(chevron, createPart('summary-text', 'span', { text: this.attr('title') }));

    this.on(summary, 'click', () => this.setOpen(!this.isOpen));
    this.prepend(summary);
  }

  get isOpen(): boolean {
    return !isContentHidden(this);
  }

  /** Open or close, updating state, ARIA and — when `sticky` — the store. */
  setOpen(open: boolean): void {
    setContentHidden(this, !open);
    this.setState('open', open);
    this.findPart('summary')?.setAttribute('aria-expanded', String(open));

    if (!this.flag('sticky')) return;
    const store = this.store();
    if (!store) return;
    store.set('collapse', { ...store.get('collapse'), [this.id]: open });
  }
}
