/**
 * `<doc-chips>` — the pill row under the lede.
 *
 * Carries real meaning, not decoration: locked decisions and reader
 * instructions (§8.2).
 */

import { DocElement } from '../core/base.js';

export class DocChips extends DocElement {
  protected enhance(): void {
    this.internals.role = 'list';
  }

  /**
   * Append a chip at runtime.
   *
   * why (§8.2): when a feedback bucket is pasted back and the agent regenerates,
   * previously answered questions surface here as `confirmed` chips. Exposing
   * this lets tooling do that without a full regeneration.
   */
  addChip(kind: string, text: string): HTMLElement {
    const chip = document.createElement('doc-chip');
    chip.setAttribute('kind', kind);
    chip.textContent = text;
    this.append(chip);
    return chip;
  }
}
