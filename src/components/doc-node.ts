/**
 * `<doc-node title="…" icon="…" tone="…">` — one card in a `doc-mindmap`.
 *
 * The card *is* the element: its own content (paragraphs, lists, code, an
 * image) stays where the author wrote it, and nested `doc-node` elements are
 * its branches. This element only adds its header — icon and title — the
 * expand toggle and the Comment button, and reports its place in the tree.
 * Where the card is drawn, and whether it is open, is the map's business:
 * it is the one that can see every card at once.
 *
 * why the host stays a block (constraint 3): a card holds author prose, so it
 * must never be a flex or grid container. In the map the branches are taken
 * out of flow by absolute positioning instead, which leaves the card's own
 * content laid out as ordinary text.
 *
 * Parts: `header`, `icon`, `title`, `toggle`, `feedback`.
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { nodeIcon } from '../core/icons.js';
import { createPart, hasFlowContent } from '../core/parts.js';

export class DocNode extends DocElement {
  protected enhance(): void {
    const title = this.attr('title');
    this.internals.role = 'treeitem';
    this.internals.ariaLabel = title;
    this.#prependHeader(title);
    // Loose text in a card is still its content; the theme spaces it from the
    // header the same way as a paragraph.
    if (hasFlowContent(this)) this.dataset.docFlow = '';

    // "Database" alone means little in the bucket; the map's title says where.
    const map = this.closest('doc-mindmap')?.getAttribute('title')?.trim();
    appendFeedbackButton(this, map ? `${map} › ${title}` : title, { icon: true });
  }

  #prependHeader(title: string): void {
    if (this.findPart('header')) return;
    const header = createPart('header');
    // The toggle goes first so the title stays the header's last child — the
    // one the corner Comment button reserves room beside.
    const toggle = createPart('toggle', 'span');
    toggle.setAttribute('aria-hidden', 'true');
    header.append(toggle);

    const glyph = nodeIcon(this.attr('icon'));
    if (glyph) header.append(glyph);
    header.append(createPart('title', 'span', { text: title }));
    this.prepend(header);
  }

  /** The `doc-node` elements written directly inside this one. */
  get branches(): HTMLElement[] {
    return Array.from(this.children).filter(
      (child): child is HTMLElement => child.tagName === 'DOC-NODE',
    );
  }

  /**
   * Show whether the card is open. A card with no branches has nothing to
   * open, so it carries no `aria-expanded` and an empty toggle.
   */
  setExpanded(open: boolean): void {
    const count = this.branches.length;
    const branch = count > 0;
    this.setState('branch', branch);
    this.setState('open', branch && open);
    this.internals.ariaExpanded = branch ? String(open) : null;
    const toggle = this.findPart('toggle');
    if (toggle) toggle.textContent = toggleText(branch, open, count);
  }

  /** Level (1 for the title's children), and place among its siblings. */
  setTreePosition(level: number, position: number, siblings: number): void {
    this.internals.ariaLevel = String(level);
    this.internals.ariaPosInSet = String(position);
    this.internals.ariaSetSize = String(siblings);
  }
}

/** `+3` on a closed card with three branches, `−` on an open one, nothing on a leaf. */
export function toggleText(branch: boolean, open: boolean, count: number): string {
  if (!branch) return '';
  return open ? '−' : `+${count}`;
}
