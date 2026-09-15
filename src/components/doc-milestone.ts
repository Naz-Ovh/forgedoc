/**
 * `<doc-milestone date="2026-Q3" title="Production Launch" status="in-progress" owner="DevOps">`
 *
 * One milestone along a delivery timeline.
 * Parts: `marker`, `date`, `header`, `title`, `owner`, `status`, `body`.
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

export class DocMilestone extends DocElement {
  protected enhance(): void {
    this.internals.role = 'listitem';

    const date = this.attr('date');
    const title = this.attr('title');
    const status = this.attr('status', 'planned');
    const owner = this.attr('owner');

    nameAuthorContent(this, 'body');

    const header = createPart('header', 'div');

    const marker = createPart('marker', 'span');
    marker.dataset.status = status;
    header.append(marker);

    if (date) {
      const dateEl = createPart('date', 'span', { text: date });
      header.append(dateEl);
    }

    const titleEl = createPart('title', 'span', { text: title });
    header.append(titleEl);

    if (owner) {
      const ownerEl = createPart('owner', 'span', { text: `@${owner}` });
      header.append(ownerEl);
    }

    const statusEl = createPart('status', 'span', { text: status });
    statusEl.dataset.status = status;
    header.append(statusEl);

    appendFeedbackButton(this, title || date, { icon: true });
    this.prepend(header);
  }
}
