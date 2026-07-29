/**
 * `<plan-chip kind="confirmed">` — one pill.
 *
 * `confirmed` marks a locked decision, `action` an instruction to the reader,
 * `pending` something still open, `info` plain context (§8.2).
 */

import { PlanElement } from '../core/base.js';
import { createPart } from '../core/parts.js';

type ChipKind = 'confirmed' | 'info' | 'action' | 'pending';

const GLYPHS: Record<ChipKind, string> = {
  confirmed: '✓',
  info: 'i',
  action: '→',
  pending: '•',
};

export class PlanChip extends PlanElement {
  protected enhance(): void {
    const kind = this.#kind();
    this.internals.role = 'listitem';

    const glyph = createPart('icon', 'span', { text: GLYPHS[kind] });
    glyph.setAttribute('aria-hidden', 'true');
    this.prepend(glyph);
  }

  #kind(): ChipKind {
    const attribute = this.attr('kind', 'info');
    return attribute in GLYPHS ? (attribute as ChipKind) : 'info';
  }
}
