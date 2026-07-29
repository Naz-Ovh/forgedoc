/**
 * `<plan-list marker="check">` — a marked list. Children are plain `<li>`.
 *
 * The atom underneath `plan-compare`, exposed separately so ✓/✗ lists work
 * outside a two-column layout (§8.3).
 */

import { PlanElement } from '../core/base.js';
import { createPart } from '../core/parts.js';

type Marker = 'check' | 'cross' | 'arrow' | 'dot' | 'number';

/** Glyph per marker. `number` is drawn by a CSS counter instead. */
const GLYPHS: Record<Marker, string> = {
  check: '✓',
  cross: '✗',
  arrow: '→',
  dot: '•',
  number: '',
};

export class PlanList extends PlanElement {
  protected enhance(): void {
    const marker = this.#marker();
    this.internals.role = 'list';

    const title = this.attr('title');
    if (title) this.prepend(createPart('title', 'div', { text: title }));

    this.#markItems(marker);
  }

  #marker(): Marker {
    const attribute = this.attr('marker', 'dot');
    return attribute in GLYPHS ? (attribute as Marker) : 'dot';
  }

  /**
   * Give each `<li>` its list role and, for glyph markers, a bullet element.
   *
   * why prepend a real element rather than a `::before`: the glyph carries
   * meaning — ✓ and ✗ are the difference between "already built" and "missing" —
   * so it has to survive copy-paste and be reachable by find-in-page.
   */
  #markItems(marker: Marker): void {
    const glyph = GLYPHS[marker];

    for (const item of Array.from(this.querySelectorAll<HTMLElement>(':scope > li'))) {
      item.dataset.part = 'item';
      if (!glyph) continue;
      if (item.querySelector(':scope > [data-part="marker"]')) continue;

      const bullet = createPart('marker', 'span', { text: glyph });
      bullet.setAttribute('aria-hidden', 'true');
      item.prepend(bullet);
    }
  }
}
