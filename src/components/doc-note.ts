/**
 * `<doc-note kind="warn" title="…">` — the coloured callout.
 *
 * Parts: `icon`, `title`, `body`. The body is the author's own children, named
 * in place rather than wrapped (§2.2).
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

type NoteKind = 'info' | 'tip' | 'warn' | 'danger' | 'success';

/** One glyph per kind. Text rather than SVG keeps the offline bundle small. */
const ICONS: Record<NoteKind, string> = {
  info: 'i',
  tip: '✦',
  warn: '!',
  danger: '✕',
  success: '✓',
};

/** Announced by assistive tech in place of the decorative glyph. */
const LABELS: Record<NoteKind, string> = {
  info: 'Note',
  tip: 'Tip',
  warn: 'Warning',
  danger: 'Danger',
  success: 'Success',
};

export class DocNote extends DocElement {
  protected enhance(): void {
    const kind = this.#kind();

    this.internals.role = 'note';
    this.internals.ariaLabel = this.attr('title') || LABELS[kind];

    nameAuthorContent(this, 'body');
    this.#prependChrome(kind);
    // A callout is one claim, and a reader who disputes it disputes all of it.
    appendFeedbackButton(this, this.attr('title') || LABELS[kind], { icon: true });
  }

  #kind(): NoteKind {
    const attribute = this.attr('kind', 'info');
    return attribute in ICONS ? (attribute as NoteKind) : 'info';
  }

  #prependChrome(kind: NoteKind): void {
    const title = this.attr('title');
    if (title) this.prepend(createPart('title', 'div', { text: title }));

    const icon = createPart('icon', 'div', { text: ICONS[kind] });
    icon.setAttribute('aria-hidden', 'true');
    this.prepend(icon);
  }
}
