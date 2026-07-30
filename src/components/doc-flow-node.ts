/**
 * `<doc-flow-node title="…" active>` — one step in a `doc-flow`.
 *
 * Child text is the subtitle. `active` is the emphasised dark node.
 */

import { DocElement } from '../core/base.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

export class DocFlowNode extends DocElement {
  protected enhance(): void {
    this.internals.role = 'listitem';
    this.setState('active', this.flag('active'));

    nameAuthorContent(this, 'subtitle');
    this.prepend(createPart('title', 'span', { text: this.attr('title') }));
  }
}
