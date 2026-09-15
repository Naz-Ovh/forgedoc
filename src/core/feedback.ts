/**
 * Block-level feedback: a stable anchor, a button, and the event it fires.
 *
 * why blocks need their own affordance (§10.2): the bucket collects comments
 * from a text selection, and a selection is a run of words. Two kinds of block
 * are badly served by that:
 *
 *   · A rendered Mermaid chart, an `<img>` or an `<svg>` has no text to select
 *     at all, so without a button the diagrams — usually the parts worth
 *     arguing about — are the only parts of a plan a reader cannot argue with.
 *   · A card *is* the unit of meaning. A question, a callout, a step, a
 *     disclosure: a reader who disagrees with one disagrees with the whole
 *     thing, and making them rubber-band exactly the right sentence to say so
 *     turns one click into a fiddly drag that lands on the wrong boundary.
 *
 * So the same button appears on both, and a comment made from it is scoped to
 * the element rather than to a range inside it — `scope: 'block'` in the store.
 * Selecting text inside those cards still works and still makes a text comment;
 * the two live side by side because they answer different questions.
 *
 * The components stay ignorant of the bucket: they append a button and dispatch
 * an event. Whether anything is listening is not their problem.
 */

import { commentIcon } from './icons.js';
import { createPart } from './parts.js';

/** Bubbles from the block to `doc-page`, where the bucket picks it up. */
export const BLOCK_FEEDBACK_EVENT = 'doc-block-feedback';

export interface BlockFeedbackDetail {
  /** Id of the element being commented on. Always present after this fires. */
  readonly anchorId: string;
  /** Human-readable descriptor, e.g. `doc-figure · Store shape`. */
  readonly label: string;
  /** Viewport rectangle of the button, for positioning the composer. */
  readonly rect: DOMRect;
}

export interface FeedbackButtonOptions {
  /**
   * Existing chrome to put the button inside — a code block's header row. With
   * no host of its own the button floats in the block's top corner instead, and
   * the element is marked `data-doc-feedback="corner"` so one stylesheet rule
   * can position and reveal every one of them.
   */
  readonly into?: HTMLElement | null;
  /**
   * Render one speech-bubble icon rather than the word "Comment".
   *
   * why the two differ: in a header row the button sits beside `Copy`, where a
   * word matches its neighbour and there is room for it. Floated over the
   * corner of a card it has to be small enough not to crowd the content it
   * belongs to, and to stay out of the way of a title that runs long.
   */
  readonly icon?: boolean;
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
 *
 * The second group is what cards added: a question's letter badges, its
 * appended Other option and its note toggle are all runtime defaults (§8.4), so
 * quoting a question back should read as the question and its answers rather
 * than as `A B C ＋ Add a note Other — type your own solution`.
 */
const FURNITURE_PARTS = [
  'feedback',
  'copy',
  'gutter',
  'lines',
  'scroll-hint',
  'sequence',
  'badge',
  'chevron',
  'control',
  'note-toggle',
  'note',
  'other',
  'marker',
  'current-marker',
];

/**
 * Parts that are furniture only inside a particular block.
 *
 * why `header` cannot go in the list above: in a code block or a diff the header
 * row holds the filename and the language pill, which are chrome wrapped around
 * the code. On a card it holds the card's *title* — the single most identifying
 * thing about a step, a milestone, a decision or a roadblock. Excluding it
 * everywhere read a step back as its body with no name on it.
 */
const SCOPED_FURNITURE = ['doc-code [data-part="header"]', 'doc-diff [data-part="header"]'];

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
const FURNITURE_SELECTOR = [
  ...FURNITURE_PARTS.map((part) => `[data-part='${part}']`),
  ...SCOPED_FURNITURE,
].join(', ');

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

  const scope = element.closest('doc-page') ?? document;
  const tag = element.tagName.toLowerCase();
  const position = Array.from(scope.querySelectorAll(tag)).indexOf(element) + 1;

  const base = `blk-${tag.replace(/^doc-/, '')}-${position}`;
  element.id = document.getElementById(base) ? `${base}-${Date.now().toString(36)}` : base;
  return element.id;
}

/**
 * Append the "Comment" affordance to a block.
 *
 * `label` is the human name of the thing — a filename, a caption, a question, a
 * card's title.
 */
export function appendFeedbackButton(
  element: HTMLElement,
  label: string,
  options: FeedbackButtonOptions = {},
): HTMLElement | null {
  if (!element.closest('doc-page')) return null;
  if (element.querySelector(':scope > [data-part="feedback"]')) return null;
  if (options.into?.querySelector(':scope > [data-part="feedback"]')) return null;

  const anchorId = ensureFeedbackAnchor(element);
  const descriptor = label
    ? `${element.tagName.toLowerCase()} · ${label}`
    : element.tagName.toLowerCase();

  const button = createPart('feedback', 'button');
  button.setAttribute('type', 'button');
  if (options.icon) button.append(commentIcon());
  else button.textContent = 'Comment';
  button.setAttribute('aria-label', `Comment on ${descriptor}`);
  button.title = 'Add a comment about this block';

  button.addEventListener('click', (event) => {
    // A card's own click handler would otherwise read this as the reader
    // choosing that option, or as a disclosure's summary being pressed.
    event.stopPropagation();
    element.dispatchEvent(
      new CustomEvent<BlockFeedbackDetail>(BLOCK_FEEDBACK_EVENT, {
        bubbles: true,
        detail: { anchorId, label: descriptor, rect: button.getBoundingClientRect() },
      }),
    );
  });

  if (options.into) {
    options.into.append(button);
    return button;
  }

  // why a marker rather than a selector listing every commentable tag: the set
  // grows, and a stylesheet that has to be edited in five themes every time is
  // a stylesheet that will be missed in one of them.
  element.dataset.docFeedback = 'corner';
  element.append(button);
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
