/**
 * `<plan-tabs>` — a tab strip.
 *
 * MUST (§8.4): arrow-key navigation, roving tabindex, `aria-selected` via
 * internals. In print the whole thing flattens into sequential sections with
 * labels as sub-headings (§8.8) — see `print.css`.
 */

import { PlanElement } from '../core/base.js';
import { setContentHidden } from '../core/disclosure.js';
import { createPart } from '../core/parts.js';
import { slugify } from '../core/slug.js';

export class PlanTabs extends PlanElement {
  #tabs: HTMLElement[] = [];
  #buttons: HTMLButtonElement[] = [];

  protected enhance(): void {
    this.#tabs = Array.from(this.querySelectorAll<HTMLElement>(':scope > plan-tab'));
    if (this.#tabs.length === 0) return;

    if (!this.id)
      this.id = `tabs-${slugify(this.#tabs.map((tab) => tab.getAttribute('label')).join('-'))}`;

    this.#buildStrip();
    this.select(this.#initialIndex(), { focus: false });
  }

  #buildStrip(): void {
    if (this.findPart('strip')) return;

    const strip = createPart('strip', 'div');
    strip.setAttribute('role', 'tablist');

    this.#buttons = this.#tabs.map((tab, index) => {
      const panelId = `${this.id}-panel-${index}`;
      tab.id = panelId;
      tab.setAttribute('role', 'tabpanel');

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.part = 'tab';
      button.dataset.planChrome = '';
      button.id = `${this.id}-tab-${index}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panelId);
      button.textContent = tab.getAttribute('label') ?? `Tab ${index + 1}`;
      tab.setAttribute('aria-labelledby', button.id);

      this.on(button, 'click', () => this.select(index));
      strip.append(button);
      return button;
    });

    this.on(strip, 'keydown', (event: KeyboardEvent) => this.#handleArrowKeys(event));
    this.prepend(strip);
  }

  /** The stored tab, then the author's `active`, then the first one. */
  #initialIndex(): number {
    const stored = this.store()?.get('tabs')[this.id];
    if (stored !== undefined && stored >= 0 && stored < this.#tabs.length) return stored;

    const authored = this.#tabs.findIndex((tab) => tab.hasAttribute('active'));
    return authored >= 0 ? authored : 0;
  }

  /**
   * Roving tabindex: exactly one button is tabbable, and the arrow keys move
   * both focus and selection between them.
   */
  #handleArrowKeys(event: KeyboardEvent): void {
    const OFFSETS: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const offset = OFFSETS[event.key];

    if (offset === undefined) {
      if (event.key === 'Home') this.select(0);
      else if (event.key === 'End') this.select(this.#tabs.length - 1);
      else return;
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const current = this.#buttons.findIndex((button) => button.tabIndex === 0);
    const next = (current + offset + this.#tabs.length) % this.#tabs.length;
    this.select(next);
  }

  /** Activate a tab by index, persisting the choice. */
  select(index: number, options: { focus?: boolean } = {}): void {
    this.#tabs.forEach((tab, position) => {
      const selected = position === index;
      setContentHidden(tab, !selected);
      tab.toggleAttribute('hidden', !selected);

      const button = this.#buttons[position];
      if (!button) return;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && options.focus !== false) button.focus();
    });

    const store = this.store();
    if (store) store.set('tabs', { ...store.get('tabs'), [this.id]: index });
  }
}
