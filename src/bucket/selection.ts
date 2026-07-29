/**
 * Range capture, anchoring and highlight painting.
 *
 * MUST (§10.2): highlights are painted with the CSS Custom Highlight API, never
 * by wrapping selections in `<mark>`. Wrapping mutates the DOM the reader is
 * selecting from, which invalidates every offset captured afterwards, nests
 * badly on overlapping highlights, and violates §2.2. `CSS.highlights` paints
 * ranges without touching the DOM at all — it is the reason the whole light-DOM
 * decision holds together.
 *
 * A `<mark>` fallback exists for browsers without the API, gated behind a
 * capability check.
 */

import { blockContentText } from '../core/feedback.js';
import type { FeedbackItem, SerializedRange } from '../core/types.js';

/** Highlight group for stored comments. */
const HIGHLIGHT_NAME = 'plan-feedback';
/** Highlight group for the comment the reader is currently looking at. */
const ACTIVE_HIGHLIGHT_NAME = 'plan-feedback-active';

/** Longest excerpt kept as the fallback locator. */
const MAX_QUOTE_LENGTH = 240;

/**
 * Marks the bucket's own chrome.
 *
 * why it exists: the composer is rendered *inside* `plan-doc`, so clicking into
 * its textarea is a `pointerup` inside the document with a collapsed selection —
 * which read as "the reader deselected everything" and closed the composer the
 * instant they tried to type in it. Events from anything carrying this attribute
 * are not selection activity and never change the pending selection.
 */
const BUCKET_UI_SELECTOR = '[data-plan-ui]';

/** Set on the element a block comment names, so CSS can outline it. */
const BLOCK_MARK = 'data-plan-commented';

interface HighlightRegistryLike {
  set(name: string, highlight: object): void;
  delete(name: string): void;
}

type HighlightConstructor = new (...ranges: Range[]) => object;

/**
 * Feature-detect the Custom Highlight API.
 *
 * why probed rather than assumed: the API landed in Safari 17.2 and Firefox 140,
 * and a plan document opened from `file://` on an older machine must degrade
 * loudly rather than silently drop every highlight.
 */
export function highlightApi(): {
  registry: HighlightRegistryLike;
  Highlight: HighlightConstructor;
} | null {
  const registry = (CSS as unknown as { highlights?: HighlightRegistryLike }).highlights;
  const Highlight = (globalThis as unknown as { Highlight?: HighlightConstructor }).Highlight;
  if (!registry || !Highlight) return null;
  return { registry, Highlight };
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turn the reader's current selection into a resilient anchor.
 *
 * The anchor is the nearest `plan-*` ancestor that has an id, plus a character
 * offset into that element's `textContent`, plus the quoted excerpt. Two
 * independent locators means a document that gained a paragraph still resolves.
 */
export function serializeSelection(planDoc: Element): SerializedRange | null {
  // why `window.getSelection()` works at all here (§2.1): there is no shadow
  // root anywhere in this library, so the selection is not scoped away from us
  // and `getComposedRanges()` with per-root bookkeeping is not needed.
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const quote = range.toString().trim();
  if (quote === '') return null;

  const anchor = nearestAnchor(range.commonAncestorContainer, planDoc);
  if (!anchor) return null;

  const start = offsetWithin(anchor, range.startContainer, range.startOffset);
  const end = offsetWithin(anchor, range.endContainer, range.endOffset);
  if (start < 0 || end < 0) return null;

  return {
    anchorId: anchor.id,
    start,
    end,
    quote: quote.slice(0, MAX_QUOTE_LENGTH),
  };
}

/** Nearest ancestor-or-self `plan-*` element carrying an id. */
function nearestAnchor(node: Node, planDoc: Element): Element | null {
  let current: Element | null =
    node instanceof Element ? node : (node.parentElement as Element | null);

  while (current) {
    if (current.tagName.toLowerCase().startsWith('plan-') && current.id) return current;
    if (current === planDoc) break;
    current = current.parentElement;
  }

  return planDoc.id ? planDoc : null;
}

/** Character offset of (node, offset) within `root`'s text, or -1 if outside. */
function offsetWithin(root: Element, node: Node, nodeOffset: number): number {
  let seen = 0;

  for (const text of textNodesOf(root)) {
    if (text === node) return seen + nodeOffset;
    seen += text.data.length;
  }

  // The boundary may sit on an element rather than a text node.
  if (node === root) return Math.min(seen, nodeOffset);
  return -1;
}

/**
 * Every text node under `root`, in document order, skipping the bucket's own UI.
 *
 * why the exclusion matters: the review panel renders each stored quote back as
 * text, and it lives *inside* `plan-doc`. Without this, a comment whose offsets
 * had shifted would fall back to searching for its quote and find it in the
 * panel listing itself — painting the reader's highlight onto the bucket rather
 * than onto the document. It also keeps offsets into `plan-doc` stable whether
 * the panel happens to be open or closed.
 */
function textNodesOf(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      return node.parentElement?.closest(BUCKET_UI_SELECTOR)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

/**
 * A human-readable location for an anchor, e.g. `3.1 Data model`.
 *
 * Serialised into the bucket so the agent reading it back knows where the
 * comment came from without resolving the anchor against the original file.
 */
export function locationLabel(node: Node): string {
  const element = node instanceof Element ? node : node.parentElement;
  const section = element?.closest('plan-section');
  if (!section) return '';

  const number = section.getAttribute('data-number') ?? '';
  const title = section.getAttribute('title') ?? '';
  return `${number} ${title}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Block anchors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when the item names a whole element rather than a character range.
 *
 * why blocks need their own scope (§10.2): a diagram, an image or a rendered
 * Mermaid chart contains no selectable text, so there is no range to serialise
 * and no range to paint. The element id *is* the anchor.
 */
export function isBlockItem(item: Pick<FeedbackItem, 'scope'>): boolean {
  return item.scope === 'block';
}

/** The element a block comment names, or null once it has left the document. */
export function blockAnchor(planDoc: Element, anchorId: string): HTMLElement | null {
  if (!anchorId) return null;
  return planDoc.querySelector<HTMLElement>(`#${CSS.escape(anchorId)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Restore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a stored anchor back to a live `Range`.
 *
 * Resolution order matches the receipt rules in `SKILL.md`: anchor id first,
 * quoted text second. Returns null when neither locator finds the text, which
 * the panel reports as an orphaned comment rather than dropping.
 */
export function resolveRange(planDoc: Element, stored: SerializedRange): Range | null {
  const anchor = planDoc.querySelector(`#${CSS.escape(stored.anchorId)}`) ?? planDoc;

  const byOffset = rangeFromOffsets(anchor, stored.start, stored.end);
  if (byOffset && normalise(byOffset.toString()) === normalise(stored.quote)) return byOffset;

  // why not fall back to `byOffset` when the quote is nowhere to be found: a
  // stale offset still *resolves*, it just resolves onto whatever text now
  // occupies those characters. Painting a reader's comment over an unrelated
  // sentence is worse than telling them the anchor is gone, so this returns null
  // and the panel flags the item as orphaned.
  return rangeFromQuote(anchor, stored.quote) ?? rangeFromQuote(planDoc, stored.quote);
}

/** Collapse whitespace so a reflowed paragraph still matches its stored quote. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function rangeFromOffsets(root: Element, start: number, end: number): Range | null {
  const startPoint = pointAt(root, start);
  const endPoint = pointAt(root, end);
  if (!startPoint || !endPoint) return null;

  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

function pointAt(root: Element, target: number): { node: Text; offset: number } | null {
  let seen = 0;

  for (const text of textNodesOf(root)) {
    const next = seen + text.data.length;
    if (target <= next) return { node: text, offset: target - seen };
    seen = next;
  }
  return null;
}

/** Locate `quote` by scanning the concatenated text of `root`. */
function rangeFromQuote(root: Element, quote: string): Range | null {
  const needle = quote.trim();
  if (needle === '') return null;

  const haystack = textNodesOf(root)
    .map((text) => text.data)
    .join('');
  const index = haystack.indexOf(needle);
  if (index < 0) return null;

  return rangeFromOffsets(root, index, index + needle.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Painting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ids of comments whose anchor no longer resolves.
 *
 * why separate from `paintHighlights`: painting is a command and this is a
 * query. Keeping them apart lets the panel *derive* the orphan list from the
 * feedback array instead of writing it back out of a side effect.
 */
export function findOrphans(planDoc: Element, items: readonly FeedbackItem[]): string[] {
  return items.filter((item) => !isAnchored(planDoc, item)).map((item) => item.id);
}

/** Whether an item's anchor still resolves — by element for blocks, by range otherwise. */
function isAnchored(planDoc: Element, item: FeedbackItem): boolean {
  if (isBlockItem(item)) return blockAnchor(planDoc, item.range.anchorId) !== null;
  return resolveRange(planDoc, item.range) !== null;
}

/** Options for one painting pass. */
export interface PaintOptions {
  /** The comment the reader is looking at, painted in the stronger colour. */
  activeId?: string | null;
  /**
   * What is being commented on but not yet saved.
   *
   * why it is painted at all: focusing the composer's textarea collapses the
   * document selection, so without this the reader loses sight of the very text
   * they are commenting on the moment they start typing about it.
   */
  pending?: { range: SerializedRange; scope: 'text' | 'block' } | null;
}

/**
 * Paint every stored comment, plus the active one in a stronger colour.
 *
 * Called after mount and on every change to the feedback list. Ranges that no
 * longer resolve are skipped and returned so the panel can mark them orphaned.
 */
export function paintHighlights(
  planDoc: Element,
  items: readonly FeedbackItem[],
  options: PaintOptions = {},
): { orphaned: string[] } {
  const { activeId = null, pending = null } = options;
  const api = highlightApi();
  const orphaned: string[] = [];
  const ranges: Range[] = [];
  const activeRanges: Range[] = [];

  markBlockAnchors(planDoc, items, activeId, pending);

  for (const item of items) {
    if (isBlockItem(item)) {
      if (!blockAnchor(planDoc, item.range.anchorId)) orphaned.push(item.id);
      continue;
    }

    const range = resolveRange(planDoc, item.range);
    if (!range) {
      orphaned.push(item.id);
      continue;
    }
    (item.id === activeId ? activeRanges : ranges).push(range);
  }

  // A block has no text range — it is outlined by `markBlockAnchors` instead.
  // Resolving one here would fall through to a quote search and paint whatever
  // text happened to match the block's descriptor.
  const pendingRange =
    pending && pending.scope === 'text' ? resolveRange(planDoc, pending.range) : null;
  if (pendingRange) activeRanges.push(pendingRange);

  if (!api) {
    paintWithMarkFallback(planDoc, ranges.concat(activeRanges));
    return { orphaned };
  }

  api.registry.set(HIGHLIGHT_NAME, new api.Highlight(...ranges));
  api.registry.set(ACTIVE_HIGHLIGHT_NAME, new api.Highlight(...activeRanges));
  return { orphaned };
}

/**
 * Outline every element that carries a block comment.
 *
 * why an attribute rather than a highlight: `CSS.highlights` paints text, and a
 * block comment may be attached to an image with no text at all. The attribute
 * lets `feedback.css` draw a border round the element itself.
 */
function markBlockAnchors(
  planDoc: Element,
  items: readonly FeedbackItem[],
  activeId: string | null,
  pending: PaintOptions['pending'],
): void {
  for (const marked of Array.from(planDoc.querySelectorAll(`[${BLOCK_MARK}]`))) {
    marked.removeAttribute(BLOCK_MARK);
  }

  for (const item of items) {
    if (!isBlockItem(item)) continue;
    const element = blockAnchor(planDoc, item.range.anchorId);
    element?.setAttribute(BLOCK_MARK, item.id === activeId ? 'active' : '');
  }

  if (pending?.scope !== 'block') return;
  blockAnchor(planDoc, pending.range.anchorId)?.setAttribute(BLOCK_MARK, 'active');
}

/**
 * `<mark>` fallback for browsers without `CSS.highlights`.
 *
 * why this is acceptable here and nowhere else (§10.2): it is the only way to
 * show a highlight at all on an old engine, and it runs *after* every anchor has
 * already been resolved, so the offsets it would otherwise corrupt have already
 * been consumed. It deliberately gives up on overlapping ranges.
 */
function paintWithMarkFallback(planDoc: Element, ranges: readonly Range[]): void {
  for (const existing of Array.from(planDoc.querySelectorAll('mark[data-plan-highlight]'))) {
    existing.replaceWith(...Array.from(existing.childNodes));
  }

  for (const range of ranges) {
    try {
      const mark = document.createElement('mark');
      mark.dataset.planHighlight = '';
      range.surroundContents(mark);
    } catch {
      // Range spans element boundaries; surroundContents refuses. Skipping one
      // highlight is better than throwing during restore.
    }
  }
}

/** Scroll a stored comment into view and flash it as active. */
export function revealFeedback(planDoc: Element, items: readonly FeedbackItem[], id: string): void {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;

  const target = isBlockItem(item)
    ? blockAnchor(planDoc, item.range.anchorId)
    : (resolveRange(planDoc, item.range)?.startContainer.parentElement ?? null);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  paintHighlights(planDoc, items, { activeId: id });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading back
// ─────────────────────────────────────────────────────────────────────────────

/** How much surrounding text the detail view shows on either side of a quote. */
const CONTEXT_RADIUS = 260;

/** An excerpt shown with the document text that sits either side of it. */
export interface AnchoredContext {
  before: string;
  quote: string;
  after: string;
  /** False when the anchor is gone and only the stored quote is left to show. */
  resolved: boolean;
}

/**
 * The document text a comment is attached to, with its surroundings.
 *
 * why read live from the DOM rather than stored alongside the comment: the
 * document may have been regenerated since the comment was written, and the
 * reader opening the detail view wants to see what the sentence says *now* —
 * that is the whole point of comparing it against what they said about it.
 */
export function contextAround(
  planDoc: Element,
  stored: SerializedRange,
  radius = CONTEXT_RADIUS,
): AnchoredContext {
  const missing: AnchoredContext = { before: '', quote: stored.quote, after: '', resolved: false };

  const anchor = planDoc.querySelector(`#${CSS.escape(stored.anchorId)}`);
  const text = anchor?.textContent ?? '';
  if (text === '') return missing;

  const bounds = locateQuote(text, stored);
  if (!bounds) return missing;

  return {
    before: ellipsise(tidy(text.slice(Math.max(0, bounds.start - radius), bounds.start)), 'start'),
    quote: tidy(text.slice(bounds.start, bounds.end)),
    after: ellipsise(tidy(text.slice(bounds.end, bounds.end + radius)), 'end'),
    resolved: true,
  };
}

/** Stored offsets first, then the quote itself — the same order as `resolveRange`. */
function locateQuote(text: string, stored: SerializedRange): { start: number; end: number } | null {
  if (normalise(text.slice(stored.start, stored.end)) === normalise(stored.quote)) {
    return { start: stored.start, end: stored.end };
  }

  const index = text.indexOf(stored.quote);
  if (index < 0) return null;
  return { start: index, end: index + stored.quote.length };
}

/** The visible text of a whole block, for a block comment's detail view. */
export function blockText(planDoc: Element, anchorId: string, limit = 900): string {
  const element = blockAnchor(planDoc, anchorId);
  return element ? blockContentText(element, limit) : '';
}

/** Collapse runs of whitespace so a reflowed paragraph reads as one line. */
function tidy(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function ellipsise(text: string, side: 'start' | 'end'): string {
  if (text === '') return text;
  return side === 'start' ? `…${text.trimStart()}` : `${text.trimEnd()}…`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Watching
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectionEvent {
  readonly range: SerializedRange;
  /** Viewport rectangle of the selection, for positioning the popover. */
  readonly rect: DOMRect;
  readonly at: string;
  /** `text` for a selection, `block` when a block's own button opened this. */
  readonly scope: 'text' | 'block';
}

/**
 * Notify when the reader finishes selecting text inside the document.
 *
 * Returns a disposer. Uses `pointerup`/`keyup` rather than `selectionchange` so
 * the popover appears once, when the drag ends, instead of flickering on every
 * intermediate selection.
 */
export function watchSelection(
  planDoc: Element,
  onSelect: (event: SelectionEvent | null) => void,
): () => void {
  const controller = new AbortController();

  const handle = (event: Event): void => {
    // MUST: the bucket's own UI is not selection activity. Clicking into the
    // composer, typing in it, or pressing its buttons all reach `document` — and
    // treating those as "the reader selected nothing" is what made the composer
    // impossible to type into.
    if ((event.target as Element | null)?.closest?.(BUCKET_UI_SELECTOR)) return;

    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    if (!anchorNode || !planDoc.contains(anchorNode)) {
      onSelect(null);
      return;
    }

    const range = serializeSelection(planDoc);
    if (!range || !selection || selection.rangeCount === 0) {
      onSelect(null);
      return;
    }

    onSelect({
      range,
      rect: selection.getRangeAt(0).getBoundingClientRect(),
      at: locationLabel(anchorNode),
      scope: 'text',
    });
  };

  document.addEventListener('pointerup', handle, { signal: controller.signal });
  document.addEventListener('keyup', handle, { signal: controller.signal });

  return () => controller.abort();
}
