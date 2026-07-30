/**
 * `<doc-quote cite="…">` — a pull quote with a distinct typographic role.
 */

import { DocElement } from '../core/base.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

export class DocQuote extends DocElement {
  protected enhance(): void {
    this.internals.role = 'blockquote';

    nameAuthorContent(this, 'body');

    const cite = this.attr('cite');
    if (cite) this.append(createPart('cite', 'div', { text: cite }));
  }
}
