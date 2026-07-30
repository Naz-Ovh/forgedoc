/**
 * `<doc-code lang="ts" title="store.ts" highlight="3-5,9">` — a code block.
 *
 * The `lang` allowlist is enforced by the validator at build time (§8.6), so a
 * reader never sees a block that silently fell back to plain text.
 *
 * ⚠ This is the one component that rewrites its own content rather than only
 * appending chrome. See `#renderHighlighted` for why, and docs/DECISIONS.md for the
 * flag against §2.2.
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart } from '../core/parts.js';
import { readBlockText } from '../core/text.js';
import { highlightToHtml, languageClass } from '../vendor/highlight.js';

export class DocCode extends DocElement {
  protected enhance(): void {
    const source = readBlockText(this);
    if (source === '') return;

    const language = this.attr('lang', 'text');
    this.internals.role = 'group';
    this.internals.ariaLabel = `${this.attr('title') || 'Code'} (${language})`;

    this.#prependHeader(language);
    this.#renderHighlighted(source, language);
    this.#appendLineLayers(source);

    // Into the header rather than the corner: the corner is already the header.
    appendFeedbackButton(this, this.attr('title') || language, this.findPart('header'));
  }

  #prependHeader(language: string): void {
    const header = createPart('header', 'div');

    const title = this.attr('title');
    if (title) header.append(createPart('title', 'span', { text: title }));
    header.append(createPart('lang', 'span', { text: language }));
    header.append(this.#createCopyButton());

    this.prepend(header);
  }

  #createCopyButton(): HTMLElement {
    const button = createPart('copy', 'button');
    button.setAttribute('type', 'button');
    button.textContent = 'Copy';

    button.addEventListener('click', () => {
      const code = this.findPart('code')?.textContent ?? '';
      void navigator.clipboard?.writeText(code).then(
        () => flash(button, 'Copied'),
        () => flash(button, 'Press ⌘C'),
      );
    });

    return button;
  }

  /**
   * Replace the raw source with a highlighted `<pre><code>`.
   *
   * why this is allowed to touch author content, unlike every other component
   * (§2.2 / docs/DECISIONS.md): syntax highlighting is by definition the substitution
   * of markup for text. Prism preserves `textContent` byte for byte, so every
   * feedback anchor — which resolves by anchor id plus a character offset into
   * `textContent` — still lands on the same characters afterwards. The failure
   * §2.2 guards against, an invalidated live `Range`, cannot occur here because
   * highlight restore runs after mount, not before it.
   */
  #renderHighlighted(source: string, language: string): void {
    const pre = createPart('code', 'pre');
    const code = document.createElement('code');
    code.className = languageClass(language);
    code.innerHTML = highlightToHtml(source, language);

    if (this.flag('wrap')) pre.dataset.wrap = '';
    pre.append(code);

    this.#removeRawSource();
    this.append(pre);
  }

  /** Drop the original text nodes now that the highlighted copy carries them. */
  #removeRawSource(): void {
    for (const node of Array.from(this.childNodes)) {
      const isChrome = node instanceof HTMLElement && node.dataset.docChrome !== undefined;
      if (isChrome) continue;
      node.remove();
    }
  }

  /**
   * Line numbers and emphasised rows, as an overlay.
   *
   * why an overlay of empty rows rather than wrapping each line: multi-line
   * tokens (a block comment, a template literal) legitimately span newlines, so
   * splitting highlighted HTML on `\n` would tear tokens in half. One empty
   * `1lh`-tall row per line sits over the block and needs no measurement.
   */
  #appendLineLayers(source: string): void {
    const lineCount = source.split('\n').length;
    const emphasised = parseLineRanges(this.attr('highlight'));

    const gutter = createPart('gutter', 'div');
    const marks = createPart('lines', 'div');
    gutter.setAttribute('aria-hidden', 'true');
    marks.setAttribute('aria-hidden', 'true');

    for (let line = 1; line <= lineCount; line += 1) {
      gutter.append(createPart('line-number', 'span', { text: String(line) }));

      const mark = createPart('line', 'div');
      if (emphasised.has(line)) mark.dataset.emphasised = '';
      marks.append(mark);
    }

    this.findPart('code')?.prepend(marks);
    this.append(gutter);
  }
}

/** `"3-5,9"` → `{3, 4, 5, 9}`. Ignores anything that is not a number or a range. */
export function parseLineRanges(specification: string): Set<number> {
  const lines = new Set<number>();
  if (!specification) return lines;

  for (const part of specification.split(',')) {
    const range = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!range) continue;

    const start = Number(range[1]);
    const end = range[2] === undefined ? start : Number(range[2]);
    for (let line = Math.min(start, end); line <= Math.max(start, end); line += 1) {
      lines.add(line);
    }
  }

  return lines;
}

/** Briefly swap a button's label, then restore it. */
function flash(button: HTMLElement, message: string): void {
  const original = button.textContent;
  button.textContent = message;
  setTimeout(() => {
    button.textContent = original;
  }, 1400);
}
