/**
 * `<plan-checklist>` — persistent reader-facing ticks. Children are plain `<li>`.
 *
 * The reference's "how we verify it works" list is something a reader actually
 * works through, so the ticks survive a reload (§8.4).
 *
 * Scope decision (§16.4): local only. Ticks are a reading aid, not an answer,
 * and they are deliberately *not* serialised into the feedback bucket — see
 * docs/DECISIONS.md.
 */

import { PlanElement } from '../core/base.js';
import { slugify } from '../core/slug.js';

export class PlanChecklist extends PlanElement {
  protected enhance(): void {
    this.internals.role = 'group';

    const items = Array.from(this.querySelectorAll<HTMLElement>(':scope > li'));
    items.forEach((item, index) => {
      this.#wireItem(item, index);
    });
  }

  /** Derived from the nearest section when the author gives no id (§8.4). */
  #scopeId(): string {
    if (this.id) return this.id;

    const section = this.closest('plan-section');
    const base = section?.id ?? 'checklist';
    const position = Array.from(this.planDoc()?.querySelectorAll('plan-checklist') ?? []).indexOf(
      this,
    );
    return `${base}-check-${position < 0 ? 0 : position}`;
  }

  #wireItem(item: HTMLElement, index: number): void {
    if (item.querySelector(':scope > [data-part="check"]')) return;

    const key = `${this.#scopeId()}-${index}-${slugify(item.textContent ?? '').slice(0, 24)}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.part = 'check';
    checkbox.dataset.planChrome = '';
    checkbox.setAttribute('aria-label', (item.textContent ?? '').trim());

    const store = this.store();
    checkbox.checked = store?.get('checks')[key] ?? false;
    item.dataset.part = 'item';
    item.toggleAttribute('data-checked', checkbox.checked);

    this.on(checkbox, 'change', () => {
      item.toggleAttribute('data-checked', checkbox.checked);
      if (!store) return;
      store.set('checks', { ...store.get('checks'), [key]: checkbox.checked });
    });

    item.prepend(checkbox);
  }
}
