/**
 * `<plan-compare>` — the two-column panel.
 *
 * The reference's "Already built" / "Missing (we build these)". Children are
 * `plan-list` blocks, each with its own `title` and `kind` (§8.6).
 *
 * MUST: stacks vertically below 1050px — see `styles/components/compare.css`.
 */

import { PlanElement } from '../core/base.js';

/** Columns when the author does not say. */
const DEFAULT_COLUMNS = 2;

export class PlanCompare extends PlanElement {
  protected enhance(): void {
    this.internals.role = 'group';
    this.style.setProperty('--plan-compare-columns', String(this.#columns()));
    this.#markColumns();
  }

  #columns(): number {
    const parsed = Number.parseInt(this.attr('columns', String(DEFAULT_COLUMNS)), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_COLUMNS;
    return parsed;
  }

  /** Name each child list as a column so authors have a stable selector. */
  #markColumns(): void {
    for (const column of Array.from(this.children)) {
      if (!(column instanceof HTMLElement)) continue;
      if (column.dataset.planChrome !== undefined) continue;
      column.dataset.part = 'column';
    }
  }
}
