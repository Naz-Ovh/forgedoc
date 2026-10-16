/**
 * `<doc-path path="apps/server/src/app.ts" line="42"></doc-path>` — a file path
 * inside a sentence.
 *
 * Renders as a code chip. With `files-root` on the `doc-page`, the chip opens
 * the file in the reader's editor (see `core/editor-links.ts`); without it, it
 * is just the chip.
 *
 * Parts: `link`, `path`.
 */

import { DocElement } from '../core/base.js';
import { ensurePagePicker, pathChip } from '../core/editor-links.js';

export class DocPath extends DocElement {
  protected enhance(): void {
    const path = this.attr('path');
    if (!path || this.findPart('path')) return;
    const line = Number.parseInt(this.attr('line'), 10);
    this.append(pathChip(this, path, line > 0 ? line : null));
    // A page whose only paths are inline still needs somewhere to pick the editor.
    ensurePagePicker(this.docPage());
  }
}
