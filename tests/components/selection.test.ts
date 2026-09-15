/**
 * §13.2: a range survives a reload cycle via the anchor scheme.
 *
 * MUST (§10.2): highlights are painted with the CSS Custom Highlight API, never
 * by wrapping ranges in `<mark>`. The DOM-untouched assertion below is the one
 * that keeps the whole light-DOM decision standing — a painter that mutated the
 * document would invalidate every offset captured after it.
 */

import { describe, expect, it } from 'vitest';

import {
  contextAround,
  highlightApi,
  locationLabel,
  paintHighlights,
  resolveRange,
  serializeSelection,
} from '../../src/bucket/selection.js';
import type { FeedbackItem, SerializedRange } from '../../src/core/types.js';
import { mountPlan, snapshotNodes } from '../helpers.js';

const DOCUMENT = `
  <doc-section title="What we are building">
    <p id="p-one">Vendors get told the moment a new order lands, without refreshing anything.</p>
    <p>A second paragraph, so the anchor has to pick the right one.</p>
  </doc-section>
  <doc-section title="Data model">
    <p>Vendors get told the moment a new order lands, without refreshing anything.</p>
  </doc-section>
`;

/** Select `text` inside `container` and return the serialised anchor. */
function selectText(docPage: Element, container: Element, text: string): SerializedRange | null {
  const node = container.firstChild as Text;
  const start = node.data.indexOf(text);
  expect(start).toBeGreaterThanOrEqual(0);

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  return serializeSelection(docPage);
}

describe('the Custom Highlight API', () => {
  it('is available in the test browser, so the fallback stays a fallback', () => {
    expect(highlightApi()).not.toBeNull();
  });
});

describe('anchoring a selection', () => {
  it('anchors to the nearest doc-* ancestor with an id', () => {
    const docPage = mountPlan(DOCUMENT);
    const paragraph = docPage.querySelector('#p-one') as HTMLElement;

    const anchor = selectText(docPage, paragraph, 'the moment a new order lands');

    expect(anchor).not.toBeNull();
    expect(anchor?.anchorId).toBe('sec-what-we-are-building');
    expect(anchor?.quote).toBe('the moment a new order lands');
    expect(anchor?.end).toBe((anchor?.start ?? 0) + 'the moment a new order lands'.length);
  });

  it('records a human-readable location for the bucket', () => {
    const docPage = mountPlan(DOCUMENT);
    const paragraph = docPage.querySelector('#p-one') as HTMLElement;

    expect(locationLabel(paragraph)).toBe('1 What we are building');
  });

  /*
   * The reload cycle. The anchor is serialised, the document is thrown away and
   * rebuilt from the same markup, and the anchor must still find the same text.
   */
  it('survives a reload cycle', () => {
    const before = mountPlan(DOCUMENT);
    const anchor = selectText(
      before,
      before.querySelector('#p-one') as HTMLElement,
      'the moment a new order lands',
    ) as SerializedRange;
    before.remove();

    const after = mountPlan(DOCUMENT);
    const restored = resolveRange(after, anchor);

    expect(restored).not.toBeNull();
    expect(restored?.toString()).toBe('the moment a new order lands');
    expect(after.querySelector('#p-one')?.contains(restored?.startContainer as Node)).toBe(true);
  });

  it('falls back to the quoted text when the offsets have shifted', () => {
    const docPage = mountPlan(DOCUMENT);
    const stale: SerializedRange = {
      anchorId: 'sec-what-we-are-building',
      start: 9999,
      end: 10_027,
      quote: 'the moment a new order lands',
    };

    const restored = resolveRange(docPage, stale);
    expect(restored?.toString()).toBe('the moment a new order lands');
  });

  it('resolves within the right section when the same sentence appears twice', () => {
    const docPage = mountPlan(DOCUMENT);
    const second = docPage.querySelectorAll('doc-section')[1] as HTMLElement;
    const paragraph = second.querySelector('p') as HTMLElement;

    const anchor = selectText(docPage, paragraph, 'without refreshing anything') as SerializedRange;
    expect(anchor.anchorId).toBe('sec-data-model');

    const restored = resolveRange(docPage, anchor);
    expect(second.contains(restored?.startContainer as Node)).toBe(true);
  });
});

describe('painting highlights', () => {
  const itemFor = (range: SerializedRange, id = 'fb-1'): FeedbackItem => ({
    id,
    createdAt: '2026-01-01T00:00:00Z',
    range,
    comment: 'is this the webhook or the order row?',
    at: '1 What we are building',
  });

  it('does not touch the DOM', () => {
    const docPage = mountPlan(DOCUMENT);
    const anchor = selectText(
      docPage,
      docPage.querySelector('#p-one') as HTMLElement,
      'the moment a new order lands',
    ) as SerializedRange;

    const before = snapshotNodes(docPage);
    const result = paintHighlights(docPage, [itemFor(anchor)]);
    const after = snapshotNodes(docPage);

    expect(result.orphaned).toEqual([]);
    expect(after).toEqual(before);
    expect(docPage.querySelectorAll('mark')).toHaveLength(0);
  });

  it('registers the range with CSS.highlights', () => {
    const docPage = mountPlan(DOCUMENT);
    const anchor = selectText(
      docPage,
      docPage.querySelector('#p-one') as HTMLElement,
      'the moment a new order lands',
    ) as SerializedRange;

    paintHighlights(docPage, [itemFor(anchor)]);

    const registry = (CSS as unknown as { highlights: Map<string, { size: number }> }).highlights;
    expect(registry.get('doc-feedback')?.size).toBe(1);
  });

  it('reports an anchor it can no longer find instead of dropping it', () => {
    const docPage = mountPlan(DOCUMENT);
    const gone: SerializedRange = {
      anchorId: 'sec-what-we-are-building',
      start: 0,
      end: 5,
      quote: 'text that was deleted from the document',
    };

    const result = paintHighlights(docPage, [itemFor(gone, 'fb-gone')]);
    expect(result.orphaned).toEqual(['fb-gone']);
  });
});

/**
 * A reader selecting several paragraphs is the ordinary case, not an edge one,
 * and the stored quote is capped at 240 characters to keep a document full of
 * comments from carrying a second copy of itself in `localStorage`.
 *
 * The bug this pins: resolution compared the range's text to that capped quote
 * with `===`. For any selection past the cap the comparison failed against
 * offsets that were perfectly correct, resolution fell through to searching for
 * the excerpt, and the excerpt is what got painted — so a long comment
 * highlighted its own first 240 characters and stopped mid-word.
 */
describe('a selection longer than the stored quote', () => {
  /** Six sentences, ~450 characters — comfortably past the 240-char cap. */
  const LONG = [
    'Driven by the same NOTIFY the hub gets, so it is immediate, and swept',
    'periodically for rows whose NOTIFY was dropped, which closes the one hole in',
    'the current pipeline, where a notification raised while nothing was listening',
    'reaches a closed app never. The column also answers whether this customer was',
    'actually pinged, straight from the database, which the mail side has always',
    'listed as a known gap in the delivery record it keeps for every message.',
  ].join(' ');

  const LONG_DOCUMENT = `<doc-section title="Sweep"><p id="p-long">${LONG}</p></doc-section>`;

  it('stores offsets and a quote that both cover all of it', () => {
    const docPage = mountPlan(LONG_DOCUMENT);
    const stored = selectText(
      docPage,
      docPage.querySelector('#p-long') as HTMLElement,
      LONG,
    ) as SerializedRange;

    // The quote is the record of what the reader commented on, so it is whole:
    // the bucket panel, the detail window and the copied payload all read it.
    expect(stored.end - stored.start).toBe(LONG.length);
    expect(stored.quote).toBe(LONG);

    docPage.remove();
  });

  it('resolves back to everything the reader selected', () => {
    const docPage = mountPlan(LONG_DOCUMENT);
    const stored = selectText(
      docPage,
      docPage.querySelector('#p-long') as HTMLElement,
      LONG,
    ) as SerializedRange;

    expect(resolveRange(docPage, stored)?.toString()).toBe(LONG);

    docPage.remove();
  });

  it('paints one highlight rather than reporting the item as orphaned', () => {
    const docPage = mountPlan(LONG_DOCUMENT);
    const stored = selectText(
      docPage,
      docPage.querySelector('#p-long') as HTMLElement,
      LONG,
    ) as SerializedRange;

    const item: FeedbackItem = {
      id: 'fb-long',
      createdAt: '2026-01-01T00:00:00Z',
      range: stored,
      comment: 'does the sweep cover a dropped NOTIFY?',
      at: '1 Sweep',
    };

    expect(paintHighlights(docPage, [item]).orphaned).toEqual([]);

    docPage.remove();
  });

  it('keeps the selected length when the offsets have gone stale', () => {
    const docPage = mountPlan(LONG_DOCUMENT);
    const stored = selectText(
      docPage,
      docPage.querySelector('#p-long') as HTMLElement,
      LONG,
    ) as SerializedRange;

    // A paragraph added above shifts every offset; the quote still finds the
    // start, and the stored length is what says where the selection ended.
    const shifted: SerializedRange = { ...stored, start: 0, end: LONG.length };
    const section = docPage.querySelector('doc-section') as HTMLElement;
    section.prepend(Object.assign(document.createElement('p'), { textContent: 'Inserted.' }));

    expect(resolveRange(docPage, shifted)?.toString()).toBe(LONG);

    docPage.remove();
  });

  it('shows the whole selection in the bucket, not the first 240 characters', () => {
    const docPage = mountPlan(LONG_DOCUMENT);
    const stored = selectText(
      docPage,
      docPage.querySelector('#p-long') as HTMLElement,
      LONG,
    ) as SerializedRange;

    // The excerpt the detail window highlights has to agree with the highlight
    // the document paints — they resolve the same anchor by the same rules.
    const context = contextAround(docPage, stored);
    expect(context.resolved).toBe(true);
    expect(context.quote).toBe(LONG);

    docPage.remove();
  });

  it('reads a quote saved by an older version, capped at 240', () => {
    const docPage = mountPlan(LONG_DOCUMENT);
    const stored = selectText(
      docPage,
      docPage.querySelector('#p-long') as HTMLElement,
      LONG,
    ) as SerializedRange;

    // What 1.1.0 wrote: correct offsets, an excerpt cut at the old cap.
    const legacy: SerializedRange = { ...stored, quote: LONG.slice(0, 240) };
    expect(legacy.quote).toHaveLength(240);

    expect(resolveRange(docPage, legacy)?.toString()).toBe(LONG);
    expect(contextAround(docPage, legacy).quote).toBe(LONG);

    docPage.remove();
  });

  it('keeps the runtime\u2019s own chrome out of the excerpt', () => {
    const docPage = mountPlan(`
      <doc-section title="Sweep">
        <doc-code lang="sql" title="One winner">UPDATE notifications SET pushed_at = now();</doc-code>
        <p id="p-after">${LONG}</p>
      </doc-section>
    `);
    const stored = selectText(
      docPage,
      docPage.querySelector('#p-after') as HTMLElement,
      LONG,
    ) as SerializedRange;

    const context = contextAround(docPage, stored);

    // The anchor is the whole section, and `textContent` on one of those runs
    // the code block's title, its language pill and its Copy and Comment
    // buttons straight into the prose. None of it is selectable, so none of it
    // belongs in a quotation of what the reader selected.
    expect(context.quote).toBe(LONG);
    expect(`${context.before}${context.after}`).not.toMatch(/Copy|Comment|sql/i);

    docPage.remove();
  });

  it('still requires an exact match when the quote was not capped', () => {
    const docPage = mountPlan(DOCUMENT);
    const wrong: SerializedRange = {
      anchorId: 'sec-what-we-are-building',
      start: 0,
      end: 5,
      quote: 'text that was deleted from the document',
    };

    // A short quote is the whole selection, so a prefix test would be a way for
    // a stale anchor to resolve onto unrelated text.
    expect(resolveRange(docPage, wrong)).toBeNull();

    docPage.remove();
  });
});
