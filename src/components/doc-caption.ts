/**
 * `<doc-caption>` — a rich caption for a `doc-figure`.
 *
 * The alternative to the `caption` attribute, for captions that need a link or
 * inline code. `doc-figure` names it as its caption part; this element only
 * carries the semantics.
 */

import { DocElement } from '../core/base.js';

export class DocCaption extends DocElement {
  protected enhance(): void {
    this.internals.role = 'caption';
  }
}
