/**
 * `<doc-blocker>` — a roadblock with an enforced shape.
 *
 * ```html
 * <doc-blocker severity="high" title="SSE stream loses CORS headers on takeover">
 *   <doc-blocks>The browser silently drops the stream — bell never updates.</doc-blocks>
 *   <doc-why>The route takes over the raw connection; plugin headers are lost.</doc-why>
 *   <doc-action>The stream route writes the CORS headers itself.</doc-action>
 * </doc-blocker>
 * ```
 *
 * Structurally distinct from `doc-note` because the shape is *validated*
 * (§8.3). Every roadblock must state what it blocks and what action resolves it;
 * `doc-blocker` without `doc-action` is a build error, not a warning. A
 * roadblock with no resolution is exactly the failure this library exists to
 * prevent.
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart } from '../core/parts.js';

type Severity = 'low' | 'medium' | 'high';

const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export class DocBlocker extends DocElement {
  protected enhance(): void {
    const severity = this.#severity();

    this.internals.role = 'note';
    this.internals.ariaLabel = `Roadblock, ${SEVERITY_LABELS[severity].toLowerCase()} severity: ${this.attr('title')}`;

    this.#prependHeader(severity);
    appendFeedbackButton(this, this.attr('title'), { icon: true });
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
    const docPage = this.docPage();
    if (!docPage) return 1;
    return Array.from(docPage.querySelectorAll('doc-blocker')).indexOf(this) + 1;
  }
}
