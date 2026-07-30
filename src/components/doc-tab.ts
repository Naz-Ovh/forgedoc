/**
 * `<doc-tab label="…" active>` — one tab panel.
 *
 * `doc-tabs` owns the strip, the roving tabindex and the persistence, because
 * every one of those is a decision across the whole set. This element only
 * names its own content.
 */

import { DocElement } from '../core/base.js';
import { nameAuthorContent } from '../core/parts.js';

export class DocTab extends DocElement {
  protected enhance(): void {
    nameAuthorContent(this, 'body');
  }
}
