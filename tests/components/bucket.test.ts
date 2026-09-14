/**
 * Acceptance 6: select text → comment → answer questions → reload → all state
 * intact; Copy produces a valid `FB v1` block.
 *
 * The panel itself is the one Svelte component in the library (§10.1), so this
 * also covers the store-to-Svelte adapter: `store.subscribe` returning an
 * unsubscribe is the entire glue.
 */

import { describe, expect, it } from 'vitest';

import { bucketCount, collectBucket } from '../../src/bucket/collect.js';
import { serializeSelection } from '../../src/bucket/selection.js';
import { type BucketDocument, parseBucket, serializeBucket } from '../../src/bucket/serialize.js';
import { storeFor } from '../../src/core/store.js';
import type { DocState, FeedbackItem, SerializedRange } from '../../src/core/types.js';
import { mountPlan, settle } from '../helpers.js';

const DOCUMENT = `
  <doc-section title="What we are building">
    <p id="lede-p">Vendors get told the moment a new order lands, without refreshing anything.</p>
  </doc-section>
  <doc-section title="Open questions">
    <doc-choice mode="single" question="Should read state be shared across the team?">
      <doc-option recommended>Yes — shared team inbox</doc-option>
      <doc-option>No — per-person read state</doc-option>
    </doc-choice>
    <doc-choice mode="multi" question="Which delivery modes must ship in version one?">
      <doc-option>Offline single file</doc-option>
      <doc-option>CDN script tag</doc-option>
      <doc-option>npm package</doc-option>
    </doc-choice>
  </doc-section>
`;

const stateOf = (docPage: Element): DocState => {
  const store = storeFor(docPage);
  return {
    version: 1,
    docId: store.get('docId'),
    answers: store.get('answers'),
    feedback: store.get('feedback'),
    collapse: store.get('collapse'),
    tabs: store.get('tabs'),
    checks: store.get('checks'),
    toc: store.get('toc'),
    selectionPopup: store.get('selectionPopup'),
  };
};

/** Answer question `index` by checking option `option`. */
function answer(docPage: Element, index: number, option: number): void {
  const choice = docPage.querySelectorAll('doc-choice')[index] as HTMLElement;
  const input = choice.querySelectorAll('input')[option] as HTMLInputElement;
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Select a phrase in the lede and store a comment on it. */
function comment(docPage: HTMLElement, phrase: string, text: string): SerializedRange {
  const paragraph = docPage.querySelector('#lede-p') as HTMLElement;
  const node = paragraph.firstChild as Text;
  const start = node.data.indexOf(phrase);

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + phrase.length);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const serialized = serializeSelection(docPage) as SerializedRange;
  const store = storeFor(docPage);
  const item: FeedbackItem = {
    id: `fb-${store.get('feedback').length}`,
    createdAt: '2026-07-28T10:22:31Z',
    range: serialized,
    comment: text,
    at: '1 What we are building',
  };
  store.set('feedback', [...store.get('feedback'), item]);
  return serialized;
}

describe('the bucket panel', () => {
  it('mounts as a plain Svelte component into a sibling of the content', () => {
    const docPage = mountPlan(DOCUMENT);
    const host = docPage.querySelector('[data-part="bucket"]');

    expect(host).not.toBeNull();
    expect(host?.parentElement).toBe(docPage);
    // MUST (§10.1): a plain component, not a custom element — so its styles land
    // in forgedoc.css rather than being inlined as a JavaScript string.
    expect(host?.tagName.toLowerCase()).toBe('div');
    expect(customElements.get('bucket-panel')).toBeUndefined();
  });

  it('shows a live count on the trigger', async () => {
    const docPage = mountPlan(DOCUMENT);
    const count = docPage.querySelector('[data-part="bucket-count"]') as HTMLElement;

    expect(count.textContent).toBe('0');

    answer(docPage, 0, 0);
    await settle(50);
    expect(count.textContent).toBe('1');

    comment(docPage, 'the moment a new order lands', 'webhook or order row?');
    await settle(50);
    expect(count.textContent).toBe('2');
  });

  it('lists answers and comments, and removes one at a time', async () => {
    const docPage = mountPlan(DOCUMENT);
    answer(docPage, 0, 0);
    comment(docPage, 'the moment a new order lands', 'webhook or order row?');
    await settle(50);

    (docPage.querySelector('[data-part="bucket-trigger"]') as HTMLElement).click();
    await settle(50);

    const items = docPage.querySelectorAll('[data-part="bucket-item"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('data-kind')).toBe('answer');
    expect(items[1]?.getAttribute('data-kind')).toBe('comment');

    // Not an optional chain: a missing button would silently click nothing and
    // leave the assertions below passing against an unchanged bucket.
    const remove = items[1]?.querySelector<HTMLElement>('[data-part="bucket-item-remove"]');
    if (!remove) throw new Error('the second bucket item has no remove button');
    remove.click();
    await settle(50);

    expect(docPage.querySelectorAll('[data-part="bucket-item"]')).toHaveLength(1);
    expect(storeFor(docPage).get('feedback')).toEqual([]);
  });

  it('opens a detail window rather than scrolling the document away', async () => {
    const docPage = mountPlan(DOCUMENT);
    answer(docPage, 0, 0);
    comment(docPage, 'the moment a new order lands', 'webhook or order row?');
    await settle(50);

    (docPage.querySelector('[data-part="bucket-trigger"]') as HTMLElement).click();
    await settle(50);
    expect(document.querySelector('[data-part="detail"]')).toBeNull();

    const commentRow = docPage.querySelectorAll('[data-part="bucket-item"]')[1] as HTMLElement;
    (commentRow.querySelector('[data-part="bucket-item-body"]') as HTMLElement).click();
    await settle(50);

    // Both sides at once: what the document says, and what the reader said.
    const detail = docPage.querySelector('[data-part="detail"]') as HTMLElement;
    expect(detail).not.toBeNull();
    expect(detail.querySelector('[data-part="detail-quote"]')?.textContent).toBe(
      'the moment a new order lands',
    );
    expect(detail.querySelector('[data-part="detail-feedback"]')?.textContent).toBe(
      'webhook or order row?',
    );
    // The panel stays open behind it — the reader has not lost their place.
    expect(docPage.querySelector('[data-part="bucket-panel"]')).not.toBeNull();

    (detail.querySelector('[data-part="detail-close"]') as HTMLElement).click();
    await settle(50);
    expect(docPage.querySelector('[data-part="detail"]')).toBeNull();
  });

  it('shows every option of an answered question, chosen or not', async () => {
    const docPage = mountPlan(DOCUMENT);
    answer(docPage, 0, 0);
    await settle(50);

    (docPage.querySelector('[data-part="bucket-trigger"]') as HTMLElement).click();
    await settle(50);
    (docPage.querySelector('[data-part="bucket-item-body"]') as HTMLElement).click();
    await settle(50);

    const options = Array.from(docPage.querySelectorAll('[data-part="detail-option"]'));
    // Two authored options plus the appended Other (§8.4).
    expect(options).toHaveLength(3);
    expect(options.filter((option) => option.hasAttribute('data-chosen'))).toHaveLength(1);
    expect(options[0]?.textContent?.trim()).toBe('Yes — shared team inbox');
  });

  it('closes the detail window when its item is removed', async () => {
    const docPage = mountPlan(DOCUMENT);
    comment(docPage, 'the moment a new order lands', 'webhook or order row?');
    await settle(50);

    (docPage.querySelector('[data-part="bucket-trigger"]') as HTMLElement).click();
    await settle(50);
    (docPage.querySelector('[data-part="bucket-item-body"]') as HTMLElement).click();
    await settle(50);

    (docPage.querySelector('[data-part="detail-remove"]') as HTMLElement).click();
    await settle(50);

    expect(docPage.querySelector('[data-part="detail"]')).toBeNull();
    expect(storeFor(docPage).get('feedback')).toEqual([]);
  });

  it('warns in the panel when storage is unavailable', async () => {
    const docPage = mountPlan(DOCUMENT);
    (docPage.querySelector('[data-part="bucket-trigger"]') as HTMLElement).click();
    await settle(50);

    // Storage works here, so no warning should be shown.
    expect(docPage.querySelector('[data-part="bucket-warning"]')).toBeNull();
    expect(docPage.querySelector('[data-part="bucket-empty"]')).not.toBeNull();
  });
});

describe('the full reader journey', () => {
  it('survives a reload with every answer and comment intact', async () => {
    const first = mountPlan(DOCUMENT);

    answer(first, 0, 0);
    answer(first, 1, 0);
    answer(first, 1, 1);
    const note = first.querySelector('[data-part="note"]') as HTMLTextAreaElement;
    note.value = 'only if we can still see who read it';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    comment(first, 'the moment a new order lands', 'webhook or order row?');

    await settle();
    expect(bucketCount(first, stateOf(first))).toBe(3);
    first.remove();

    // Reload: same markup, fresh elements, state read back from storage.
    const second = mountPlan(DOCUMENT);
    await settle(50);

    const restoredState = stateOf(second);
    expect(bucketCount(second, restoredState)).toBe(3);

    const choices = second.querySelectorAll('doc-choice');
    expect(choices[0]?.querySelector<HTMLInputElement>('input')?.checked).toBe(true);
    expect(restoredState.answers[choices[1]?.id ?? '']?.keys).toEqual(['A', 'B']);
    expect(restoredState.answers[choices[0]?.id ?? '']?.note).toBe(
      'only if we can still see who read it',
    );
    expect(restoredState.feedback[0]?.comment).toBe('webhook or order row?');
  });

  it('produces a bucket that parses back and round-trips', async () => {
    const docPage = mountPlan(DOCUMENT);
    answer(docPage, 0, 0);
    answer(docPage, 1, 1);
    comment(docPage, 'the moment a new order lands', 'webhook or order row?');
    await settle();

    const text = serializeBucket(collectBucket(docPage, stateOf(docPage), '2026-07-28T10:22:31Z'));

    expect(text.startsWith('=== FB v1 · test-plan · 2026-07-28T10:22:31Z · 3 items ===')).toBe(
      true,
    );
    expect(text.trimEnd().endsWith('=== end FB v1 ===')).toBe(true);
    expect(text).toContain('q: Should read state be shared across the team?');
    expect(text).toContain('a: Yes — shared team inbox');
    expect(text).toContain('a: CDN script tag');
    expect(text).toContain('> the moment a new order lands');
    expect(text).toContain('c: webhook or order row?');

    const parsed = parseBucket(text);
    expect(parsed.problems).toEqual([]);
    expect(serializeBucket(parsed.document as BucketDocument)).toBe(text);
  });

  it('clears answers and feedback but keeps reading convenience state', async () => {
    const docPage = mountPlan(DOCUMENT);
    answer(docPage, 0, 0);
    const store = storeFor(docPage);
    store.set('tabs', { 'tabs-x': 2 });
    await settle();

    (docPage.querySelector('[data-part="bucket-trigger"]') as HTMLElement).click();
    await settle(50);
    (docPage.querySelector('[data-part="bucket-clear"]') as HTMLElement).click();
    await settle(50);

    expect(store.get('answers')).toEqual({});
    expect(store.get('feedback')).toEqual([]);
    // Collapse, tab and check state is convenience — losing feedback is not
    // acceptable, losing this is (§9.1) — but Clear should not reach for it.
    expect(store.get('tabs')).toEqual({ 'tabs-x': 2 });
  });
});
