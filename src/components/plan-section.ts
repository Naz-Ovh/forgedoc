/**
 * `<plan-section title="…">` — the highest-value component in the library.
 *
 * The agent writes a title. The runtime derives the number, the id, the heading
 * element and the TOC entry (§8.1). Nothing about a section's position in the
 * document is ever typed by hand, so inserting a section in the middle cannot
 * leave a stale reference behind.
 */

import { PlanElement } from '../core/base.js';
import { indexFor, type OutlineEntry } from '../core/numbering.js';
import { createPart, nameAuthorContent } from '../core/parts.js';
import { sectionId } from '../core/slug.js';

/** Heading level per depth. Depth 1 is `h2`; `h1` belongs to `plan-header`. */
const HEADING_TAGS = ['h2', 'h3', 'h4'] as const;

export class PlanSection extends PlanElement {
  protected enhance(): void {
    const entry = this.#outlineEntry();
    this.dataset.depth = String(entry.depth);
    this.dataset.number = entry.number;
    if (!this.id) this.id = entry.id;

    this.#prependHeading(entry);
    nameAuthorContent(this, 'body');
  }

  /** This section's row in the document outline, with a standalone fallback. */
  #outlineEntry(): OutlineEntry {
    const planDoc = this.planDoc();
    const found = planDoc
      ? indexFor(planDoc).outline.find((candidate) => candidate.element === this)
      : undefined;
    if (found) return found;

    // Used outside a plan-doc — in a test harness, or a fragment being previewed.
    const title = this.attr('title');
    return { element: this, id: sectionId(title), depth: 1, number: '1', title };
  }

  /**
   * Build the heading: a number badge followed by the title.
   *
   * This is pure chrome — both halves come from an attribute, so nothing is
   * moved and §2.2 is satisfied by construction.
   *
   * MUST (§8.1): the number is at least as large as the heading text and shrinks
   * with depth. It is never small chrome beside a big heading.
   */
  #prependHeading(entry: OutlineEntry): void {
    const headingTag = HEADING_TAGS[entry.depth - 1] ?? 'h4';
    const heading = createPart('heading', headingTag);

    const number = createPart('number', 'span');
    // why empty (§8.1, §16.1): the digits come from CSS counters by default, so
    // renumbering costs nothing. `numbering="text"` fills them in as real text
    // when the reader needs to select and copy them.
    if (this.#numbersAsText()) {
      number.textContent = entry.number;
      number.dataset.numberingMode = 'text';
    }
    number.setAttribute('aria-hidden', 'true');

    const title = createPart('title', 'span', { text: entry.title });

    heading.append(number, title);
    this.prepend(heading);
  }

  #numbersAsText(): boolean {
    return this.planDoc()?.getAttribute('numbering') === 'text';
  }
}
