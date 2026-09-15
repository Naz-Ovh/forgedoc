/**
 * `<doc-decision id="ADR-001" title="Database Choice" status="accepted" date="2026-08-28">`
 *
 * Architecture Decision Record / Decision card.
 * Parts: `header`, `badge-id`, `status`, `title`, `date`, `body`.
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

type DecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded' | 'deprecated';

export class DocDecision extends DocElement {
  protected enhance(): void {
    this.internals.role = 'region';
    this.internals.ariaLabel = `Decision: ${this.attr('title')}`;

    const decisionId = this.attr('id');
    const title = this.attr('title');
    const status = (this.attr('status', 'proposed') as DecisionStatus).toLowerCase();
    const date = this.attr('date');

    nameAuthorContent(this, 'body');

    const header = createPart('header', 'div');

    if (decisionId) {
      const idBadge = createPart('badge-id', 'span', { text: decisionId });
      header.append(idBadge);
    }

    const statusBadge = createPart('status', 'span', { text: status.toUpperCase() });
    statusBadge.dataset.status = status;
    header.append(statusBadge);

    if (title) {
      const titleEl = createPart('title', 'span', { text: title });
      header.append(titleEl);
    }

    if (date) {
      const dateEl = createPart('date', 'span', { text: date });
      header.append(dateEl);
    }

    appendFeedbackButton(this, title || decisionId, { icon: true });
    this.prepend(header);
  }
}
