/**
 * `<doc-change actor="…" add="…" remove="…" set="…" tone="…" drop>` — a change
 * to one actor during a `doc-scene`.
 *
 * Data only: `doc-walkthrough` reads it and applies it to the actor's card.
 * Changes accumulate, so a row added here is still on the card three scenes on.
 */

import { DocElement } from '../core/base.js';

export class DocChange extends DocElement {
  protected enhance(): void {}
}
