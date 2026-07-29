/**
 * `<plan-blocker>` — a roadblock with an enforced shape.
 *
 * ```html
 * <plan-blocker severity="high" title="SSE stream loses CORS headers on takeover">
 *   <plan-blocks>The browser silently drops the stream — bell never updates.</plan-blocks>
 *   <plan-why>The route takes over the raw connection; plugin headers are lost.</plan-why>
 *   <plan-action>The stream route writes the CORS headers itself.</plan-action>
 * </plan-blocker>
 * ```
 *
 * Structurally distinct from `plan-note` because the shape is *validated*
 * (§8.3). Every roadblock must state what it blocks and what action resolves it;
 * `plan-blocker` without `plan-action` is a build error, not a warning. A
 * roadblock with no resolution is exactly the failure this library exists to
 * prevent.
 */

import { PlanElement } from '../core/base.js';
import { createPart } from '../core/parts.js';

type Severity = 'low' | 'medium' | 'high';

const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export class PlanBlocker extends PlanElement {
  protected enhance(): void {
    const severity = this.#severity();

    this.internals.role = 'note';
    this.internals.ariaLabel = `Roadblock, ${SEVERITY_LABELS[severity].toLowerCase()} severity: ${this.attr('title')}`;

    this.#prependHeader(severity);
  }

  #severity(): Severity {
    const attribute = this.attr('severity', 'medium');
    return attribute in SEVERITY_LABELS ? (attribute as Severity) : 'medium';
  }

  /** Sequence number, severity pill and title — all derived, all chrome. */
  #prependHeader(severity: Severity): void {
    const header = createPart('header', 'div');

    const sequence = createPart('sequence', 'span', { text: `Roadblock ${this.#position()}` });
    const badge = createPart('severity', 'span', { text: SEVERITY_LABELS[severity] });
    const title = createPart('title', 'span', { text: this.attr('title') });

    header.append(sequence, badge, title);
    this.prepend(header);
  }

  /** 1-based position among the document's roadblocks. */
  #position(): number {
    const planDoc = this.planDoc();
    if (!planDoc) return 1;
    return Array.from(planDoc.querySelectorAll('plan-blocker')).indexOf(this) + 1;
  }
}
