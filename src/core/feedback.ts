/**
 * Block-level feedback: a stable anchor, a button, and the event it fires.
 *
 * why blocks need their own affordance (§10.2): the bucket collects comments
 * from a text selection, and a rendered Mermaid chart, an `<img>` or an `<svg>`
 * has no text to select. Without this a reader can comment on every sentence of
 * a plan and on none of its diagrams — which are usually the parts worth arguing
 * about.
 *
 * The components stay ignorant of the bucket: they append a button and dispatch
 * an event. Whether anything is listening is not their problem.
 */

import { createPart } from './parts.js';

/** Bubbles from the block to `plan-doc`, where the bucket picks it up. */
export const BLOCK_FEEDBACK_EVENT = 'plan-block-feedback';

export interface BlockFeedbackDetail {
  /** Id of the element being commented on. Always present after this fires. */
  readonly anchorId: string;
  /** Human-readable descriptor, e.g. `plan-figure · Store shape`. */
  readonly label: string;
  /** Viewport rectangle of the button, for positioning the composer. */
  readonly rect: DOMRect;
}

/**
 * Elements whose text is machine output, never content.
 *
 * why this is not hypothetical: Mermaid injects a `<style>` block into the SVG
 * it renders, so a comment on a diagram opened its detail view showing several
 * hundred characters of generated CSS instead of the diagram's own labels.
 */
const OPAQUE_ELEMENTS = new Set(['STYLE', 'SCRIPT', 'TEMPLATE']);

/**
 * Parts that are the runtime's own furniture rather than the block's content.
 *
 * Excluded from `blockContentText` so a comment's detail view shows the diagram
 * or the code, not the words "Copy" and "Comment".
 */
const FURNITURE_PARTS = [
  'feedback',
  'copy',
  'header',
  'gutter',
  'lines',
  'scroll-hint',
  'sequence',
  'badge',
  'chevron',
];

/**
 * Matches furniture at any depth, not just the nearest named ancestor.
 *
 * why the distinction bit: a code block's title lives at
 * `[data-part="header"] > [data-part="title"]` and its line numbers at
 * `[data-part="gutter"] > [data-part="line-number"]`. Asking the *nearest*
 * `[data-part]` returns `title` and `line-number`, neither of which is in the
 * list — so the filename and the digits 1…10 were both read back as if they were
 * part of the code.
 */
const FURNITURE_SELECTOR = FURNITURE_PARTS.map((part) => `[data-part='${part}']`).join(', ');

/**
 * Give `element` an id that survives a reload.
 *
 * why derived from document position rather than random: the id is written into
 * persisted state, so it has to be the same string the next time the same
 * document is opened. Position among elements of the same tag is stable for an
 * unchanged document, and when the document *has* changed the bucket falls back
 * to the stored quote exactly as it does for a text anchor.
 */
export function ensureFeedbackAnchor(element: HTMLElement): string {
  if (element.id) return element.id;

  const scope = element.closest('plan-doc') ?? document;
  const tag = element.tagName.toLowerCase();
  const position = Array.from(scope.querySelectorAll(tag)).indexOf(element) + 1;

  const base = `blk-${tag.replace(/^plan-/, '')}-${position}`;
  element.id = document.getElementById(base) ? `${base}-${Date.now().toString(36)}` : base;
  return element.id;
}

/**
 * Append the "Comment" affordance to a block.
 *
 * `label` is the human name of the thing — a filename, a caption, a language.
 * `into` places the button inside existing chrome (a code block's header row);
 * without it the button floats in the block's own top corner.
 */
export function appendFeedbackButton(
  element: HTMLElement,
  label: string,
  into?: HTMLElement | null,
): HTMLElement | null {
  if (!element.closest('plan-doc')) return null;
  if (element.querySelector(':scope > [data-part="feedback"]')) return null;

  const anchorId = ensureFeedbackAnchor(element);
  const descriptor = label
    ? `${element.tagName.toLowerCase()} · ${label}`
    : element.tagName.toLowerCase();

  const button = createPart('feedback', 'button');
  button.setAttribute('type', 'button');
  button.textContent = 'Comment';
  button.setAttribute('aria-label', `Comment on ${descriptor}`);
  button.title = 'Add a comment about this block';

  button.addEventListener('click', () => {
    element.dispatchEvent(
      new CustomEvent<BlockFeedbackDetail>(BLOCK_FEEDBACK_EVENT, {
        bubbles: true,
        detail: { anchorId, label: descriptor, rect: button.getBoundingClientRect() },
      }),
    );
  });

  (into ?? element).append(button);
  return button;
}

/**
 * The text a block is *about*, with the runtime's own furniture left out.
 *
 * Used by the bucket's detail view to show what a block comment is attached to.
 */
export function blockContentText(element: Element, limit = 900): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = node.parentElement;
      if (parent && OPAQUE_ELEMENTS.has(parent.tagName.toUpperCase())) {
        return NodeFilter.FILTER_REJECT;
      }

      return parent?.closest(FURNITURE_SELECTOR)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });

  /*
   * Two joins, because two kinds of block.
   *
   * A code block or a diff renders inside `<pre>` and its line breaks and
   * indentation *are* the content, so its text nodes are concatenated verbatim.
   * A diagram or a tree is a pile of separate labels with layout whitespace
   * between them, which concatenated verbatim reads as one run-on word — so
   * those are trimmed per node and joined with a space.
   */
  const preformatted = element.querySelector('pre') !== null;

  const pieces: string[] = [];
  let length = 0;
  let node = walker.nextNode();
  while (node && length <= limit) {
    const raw = (node as Text).data;
    const piece = preformatted ? raw : raw.trim();
    if (piece === '') {
      node = walker.nextNode();
      continue;
    }
    pieces.push(piece);
    length += piece.length + 1;
    node = walker.nextNode();
  }

  const text = pieces
    .join(preformatted ? '' : ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}
