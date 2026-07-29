/**
 * `<plan-flow>` — the horizontal chain.
 *
 * `Customer pays → Server settles → Notification → Bell + toast → Table → drawer`
 *
 * why this is not a Mermaid job (§8.5): each node has a title plus a subtitle,
 * one node can be emphasised, and it has to sit inline at reading width without
 * an SVG layout engine deciding where things go.
 *
 * MUST: wraps to multiple rows below 1050px, with the arrows rotating — see
 * `styles/components/flow.css`.
 */

import { PlanElement } from '../core/base.js';
import { createPart } from '../core/parts.js';

export class PlanFlow extends PlanElement {
  protected enhance(): void {
    this.internals.role = 'list';

    const nodes = Array.from(this.querySelectorAll<HTMLElement>(':scope > plan-flow-node'));
    nodes.forEach((node, index) => {
      if (index === 0) return;
      // The arrow belongs *before* the node it points at, and it is generated
      // chrome inserted between two author elements — nothing is moved (§2.2).
      const arrow = createPart('arrow', 'span', { text: '→' });
      arrow.setAttribute('aria-hidden', 'true');
      node.before(arrow);
    });
  }
}
