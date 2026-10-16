/**
 * `<doc-actor name="…" label="…" kind="…" tone="…">` — one participant on a
 * `doc-walkthrough` stage.
 *
 * Data only. The walkthrough reads it and draws a card for it on the stage;
 * the element itself stays where the author wrote it and is not displayed
 * (§2.2 — see `doc-walkthrough.ts` for why the card is not this element).
 */

import { DocElement } from '../core/base.js';

export class DocActor extends DocElement {
  protected enhance(): void {
    // Hidden from assistive technology as well as from view: the card on the
    // stage carries the same words, and reading them twice is noise.
    this.internals.ariaHidden = 'true';
  }
}
