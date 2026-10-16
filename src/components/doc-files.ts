/**
 * `<doc-files title="…">` — a stack of collapsible file groups on a surface of
 * its own.
 *
 * Holds `doc-file-group` children and, before or between them, ordinary prose
 * — an intro line, a list — laid out inside the same surface. With
 * `files-root` on the `doc-page`, it also carries the editor picker in its
 * top corner (see `core/editor-links.ts`).
 */

import { DocElement } from '../core/base.js';
import { editorPicker } from '../core/editor-links.js';

export class DocFiles extends DocElement {
  protected enhance(): void {
    this.internals.role = 'group';
    const title = this.attr('title');
    if (title) this.internals.ariaLabel = title;

    const docPage = this.docPage();
    if (!docPage?.getAttribute('files-root') || this.findPart('editor-picker')) return;
    const picker = editorPicker(docPage);
    picker.dataset.placement = 'files';
    // Chrome before the author's content, floated to the corner by the
    // stylesheet so an intro sentence wraps beside it (§2.2: nothing moves).
    this.prepend(picker);
  }
}
