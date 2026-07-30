/**
 * `<doc-table>` — wraps a plain `<table>`.
 *
 * MUST (§8.3): below 1050px, `stack="auto"` converts rows into stacked
 * label/value cards. Tables are the first thing that breaks on a narrow
 * viewport, and a plan document is read on a phone at least as often as on a
 * desktop.
 */

import { DocElement } from '../core/base.js';
import { createPart } from '../core/parts.js';

export class DocTable extends DocElement {
  protected enhance(): void {
    const table = this.querySelector('table');
    if (!table) return;

    table.dataset.part = 'table';
    this.#markHeaderCells(table);
    this.#wrapForOverflow(table);
  }

  /**
   * Copy each column's header text onto the cells below it.
   *
   * why on the cell rather than a `::before` from a counter: the stacked card
   * layout needs the *text* of the header, which CSS cannot read from another
   * element. `data-label` is set once at mount and the stacked layout renders it
   * with `attr()`.
   */
  #markHeaderCells(table: HTMLTableElement): void {
    if (this.attr('stack', 'auto') === 'never') return;

    const headers = Array.from(table.querySelectorAll<HTMLElement>('thead th')).map(
      (cell) => cell.textContent?.trim() ?? '',
    );
    if (headers.length === 0) return;

    for (const row of Array.from(table.querySelectorAll<HTMLElement>('tbody tr'))) {
      Array.from(row.children).forEach((cell, column) => {
        if (!(cell instanceof HTMLElement)) return;
        const label = headers[column];
        if (label) cell.dataset.label = label;
      });
    }
  }

  /**
   * Give a wide table its own scroll container.
   *
   * why an *appended* element that the table is not moved into: §2.2 forbids
   * reparenting author content, so instead the scroller is a sibling and CSS
   * subgrid is not needed — `doc-table` itself is the scroll port and the
   * marker below only records that it may overflow.
   */
  #wrapForOverflow(table: HTMLTableElement): void {
    this.internals.role = 'group';
    this.internals.ariaLabel = table.querySelector('caption')?.textContent?.trim() ?? 'Table';
    this.setAttribute('tabindex', '0');

    if (this.findPart('scroll-hint')) return;
    const hint = createPart('scroll-hint', 'div', { text: 'Scroll for more →' });
    hint.setAttribute('aria-hidden', 'true');
    this.append(hint);
  }
}
