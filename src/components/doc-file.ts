/**
 * `<doc-file path="schema/user.ts">split into <code>customer.ts</code></doc-file>`
 * — one entry in a `doc-file-group`.
 *
 * The path becomes a code chip; the content, if any, is the note after it and
 * may hold inline HTML. Without `path` the content is the whole entry.
 *
 * With `files-root` on the `doc-page`, the chip opens the file in the reader's
 * editor (see `core/editor-links.ts`).
 *
 * Parts: `link`, `path`, `note*`.
 */

import { DocElement } from '../core/base.js';
import { pathChip } from '../core/editor-links.js';
import { nameAuthorContent } from '../core/parts.js';

export class DocFile extends DocElement {
  protected enhance(): void {
    this.internals.role = 'listitem';
    nameAuthorContent(this, 'note');

    const path = this.attr('path');
    if (!path || this.findPart('path')) return;
    const line = Number.parseInt(this.attr('line'), 10);
    // A space after the chip: the note is the rest of the same line.
    const base = this.closest('doc-file-group')?.getAttribute('path')?.trim() ?? '';
    this.prepend(pathChip(this, path, line > 0 ? line : null, base), document.createTextNode(' '));
  }
}
