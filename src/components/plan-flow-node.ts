/**
 * `<plan-flow-node title="…" active>` — one step in a `plan-flow`.
 *
 * Child text is the subtitle. `active` is the emphasised dark node.
 */

import { PlanElement } from '../core/base.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

export class PlanFlowNode extends PlanElement {
  protected enhance(): void {
    this.internals.role = 'listitem';
    this.setState('active', this.flag('active'));

    nameAuthorContent(this, 'subtitle');
    this.prepend(createPart('title', 'span', { text: this.attr('title') }));
  }
}
