/**
 * `<doc-step title="..." status="...">` — one step in a step-by-step walkthrough.
 *
 * Parts: `marker`, `card`, `header`, `title`, `body`.
 */

import { DocElement } from '../core/base.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

export class DocStep extends DocElement {
  protected enhance(): void {
    this.internals.role = 'listitem';

    const title = this.attr('title');

    nameAuthorContent(this, 'body');

    const marker = createPart('marker', 'div');

    const card = createPart('card', 'div');
    const header = createPart('header', 'div');
    const titleEl = createPart('title', 'h4', { text: title });
    header.append(titleEl);
    card.append(header);

    const bodyEl = this.querySelector('[data-part="body"]');
    if (bodyEl) {
      card.append(bodyEl);
    }

    this.prepend(card);
    this.prepend(marker);
  }
}
