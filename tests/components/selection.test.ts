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
