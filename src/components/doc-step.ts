/**
 * `<doc-step title="..." status="...">` — one step in a step-by-step walkthrough.
 *
 * Parts: `marker`, `header`, `title`, `body`.
 *
 * why no `card` element (§2.2): the card used to be a generated `<div>` that the
 * body was moved into, which is the one thing `enhance()` may never do — and it
 * only ever moved the *first* child, so a step written as a sentence had its
 * `<code>` chips left behind outside the box. The card is paint, not structure:
 * the host carries the border, the background and the inset, and the marker is
 * positioned into the gutter beside it. Nothing moves.
 */

import { DocElement } from '../core/base.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

export class DocStep extends DocElement {
  protected enhance(): void {
    this.internals.role = 'listitem';

    nameAuthorContent(this, 'body');

    const header = createPart('header', 'div');
    header.append(createPart('title', 'h4', { text: this.attr('title') }));

    this.prepend(header);
    this.prepend(createPart('marker', 'div'));
  }
}
