/**
 * Block-level feedback, and the composer bugs it shares with text selection.
 *
 * Two of these are regressions against bugs that made the feature unusable
 * rather than merely wrong:
 *
 *   · The composer closed the instant it was clicked into. `watchSelection`
 *     listens on `document`, the composer renders *inside* `doc-page`, and
 *     clicking its textarea is a `pointerup` with a collapsed selection — which
 *     read as "the reader selected nothing".
 *   · A pending *block* comment was resolved as if it were a text range. With no
 *     real range to find, the quote search fell through to the whole document
 *     and matched the composer's own label, painting a highlight inside the
 *     bucket's UI.
 */

import { describe, expect, it } from 'vitest';
import { detailForComment } from '../../src/bucket/detail.js';
import { blockText, findOrphans, paintHighlights } from '../../src/bucket/selection.js';
import { BLOCK_FEEDBACK_EVENT, blockContentText } from '../../src/core/feedback.js';
import { storeFor } from '../../src/core/store.js';
import type { FeedbackItem } from '../../src/core/types.js';
import { mountPlan, settle } from '../helpers.js';

const DOCUMENT = `
  <doc-section title="How it looks in code">
    <p id="lede-p">Vendors get told the moment a new order lands.</p>
    <doc-code lang="ts" title="store.ts">const store = createStore(docId);
const answer = store.get('answers');</doc-code>
    <doc-figure type="svg" caption="Store shape">
      <svg viewBox="0 0 10 10"><title>Boxes</title><rect width="10" height="10" /></svg>
    </doc-figure>
    <doc-tree root="src/">core/
  store.ts</doc-tree>
    <doc-diff filename="src/store.ts">-const a = 1;
+const a = 2;</doc-diff>
  </doc-section>
`;

const feedbackButton = (docPage: Element, selector: string): HTMLElement =>
  docPage.querySelector(`${selector} [data-part="feedback"]`) as HTMLElement;

describe('the Comment button on a block', () => {
  it('appears on every block a reader cannot select text in', () => {
    const docPage = mountPlan(DOCUMENT);

    for (const tag of ['doc-code', 'doc-figure', 'doc-tree', 'doc-diff']) {
      expect(feedbackButton(docPage, tag), `${tag} has no Comment button`).not.toBeNull();
    }
  });

  it('joins the header of a block that already has one', () => {
    const docPage = mountPlan(DOCUMENT);

    const inCodeHeader = docPage.querySelector(
      'doc-code [data-part="header"] [data-part="feedback"]',
    );
    const inDiffHeader = docPage.querySelector(
      'doc-diff [data-part="header"] [data-part="feedback"]',
    );
    expect(inCodeHeader).not.toBeNull();
    expect(inDiffHeader).not.toBeNull();

    // A figure has no header row, so its button is its own direct child and the
    // stylesheet floats it in the corner.
    const inFigure = docPage.querySelector('doc-figure > [data-part="feedback"]');
    expect(inFigure).not.toBeNull();
  });

  it('is chrome, so it never counts as author content', () => {
    const docPage = mountPlan(DOCUMENT);
    expect(feedbackButton(docPage, 'doc-figure').dataset.docChrome).toBe('');
  });

  it('gives the block an id that is stable across a reload', () => {
    const first = mountPlan(DOCUMENT);
    const firstId = (first.querySelector('doc-figure') as HTMLElement).id;
    first.remove();

    const second = mountPlan(DOCUMENT);
    expect((second.querySelector('doc-figure') as HTMLElement).id).toBe(firstId);
    expect(firstId).toMatch(/^blk-figure-\d+$/);
  });

  it('leaves an author-written id alone', () => {
    const docPage = mountPlan(
      '<doc-section title="S"><doc-figure id="my-diagram" type="svg"><svg viewBox="0 0 1 1"></svg></doc-figure></doc-section>',
    );
    expect((docPage.querySelector('doc-figure') as HTMLElement).id).toBe('my-diagram');
  });

  it('dispatches one bubbling event carrying everything the bucket needs', () => {
    const docPage = mountPlan(DOCUMENT);
    const seen: unknown[] = [];
    docPage.addEventListener(BLOCK_FEEDBACK_EVENT, (event) =>
      seen.push((event as CustomEvent).detail),
    );

    feedbackButton(docPage, 'doc-figure').click();

    expect(seen).toHaveLength(1);
    const detail = seen[0] as { anchorId: string; label: string; rect: DOMRect };
    expect(detail.anchorId).toBe((docPage.querySelector('doc-figure') as HTMLElement).id);
    expect(detail.label).toBe('doc-figure · Store shape');
    expect(typeof detail.rect.bottom).toBe('number');
  });
});

describe('the composer', () => {
  /**
   * Mount, then let the panel's effects run before touching anything.
   *
   * why: the bucket subscribes to block-feedback events from a Svelte `$effect`,
   * which is scheduled rather than synchronous. No real reader can click inside
   * the same microtask as mount; a test can.
   */
  async function mountReady(): Promise<HTMLElement> {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);
    return docPage;
  }

  it('opens from a block button and saves a block-scoped comment', async () => {
    const docPage = await mountReady();
    feedbackButton(docPage, 'doc-figure').click();
    await settle(50);

    const draft = docPage.querySelector('[data-part="bucket-draft"]') as HTMLTextAreaElement;
    expect(draft).not.toBeNull();

    draft.value = 'The arrows point the wrong way.';
    draft.dispatchEvent(new Event('input', { bubbles: true }));
    (docPage.querySelector('[data-part="bucket-save"]') as HTMLElement).click();
    await settle(50);

    const stored = storeFor(docPage).get('feedback');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.scope).toBe('block');
    expect(stored[0]?.comment).toBe('The arrows point the wrong way.');
    expect(stored[0]?.range.anchorId).toBe((docPage.querySelector('doc-figure') as HTMLElement).id);
  });

  it('survives being clicked into', async () => {
    const docPage = await mountReady();
    feedbackButton(docPage, 'doc-code').click();
    await settle(50);

    const draft = docPage.querySelector('[data-part="bucket-draft"]') as HTMLTextAreaElement;
    draft.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    draft.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    await settle(50);

    // MUST: still there. This is the bug that made the composer impossible to
    // type into — every click inside it dismissed it.
    expect(docPage.querySelector('[data-part="bucket-draft"]')).not.toBeNull();
  });

  it('is dismissed by a click in the document, as before', async () => {
    const docPage = await mountReady();
    feedbackButton(docPage, 'doc-code').click();
    await settle(50);
    expect(docPage.querySelector('[data-part="bucket-draft"]')).not.toBeNull();

    (docPage.querySelector('#lede-p') as HTMLElement).dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true }),
    );
    await settle(50);

    expect(docPage.querySelector('[data-part="bucket-draft"]')).toBeNull();
  });
});

describe('a stored block comment', () => {
  const itemFor = (anchorId: string): FeedbackItem => ({
    id: 'fb-block',
    createdAt: '2026-07-28T10:22:31Z',
    range: { anchorId, start: 0, end: 0, quote: 'doc-figure · Store shape' },
    comment: 'The arrows point the wrong way.',
    at: '1 How it looks in code',
    scope: 'block',
  });

  it('outlines its element instead of painting a text range', () => {
    const docPage = mountPlan(DOCUMENT);
    const figure = docPage.querySelector('doc-figure') as HTMLElement;

    const result = paintHighlights(docPage, [itemFor(figure.id)]);

    expect(result.orphaned).toEqual([]);
    expect(figure.hasAttribute('data-doc-commented')).toBe(true);
  });

  it('is orphaned only when its element has gone', () => {
    const docPage = mountPlan(DOCUMENT);
    const figure = docPage.querySelector('doc-figure') as HTMLElement;

    expect(findOrphans(docPage, [itemFor(figure.id)])).toEqual([]);
    expect(findOrphans(docPage, [itemFor('blk-figure-404')])).toEqual(['fb-block']);
  });

  it('never resolves a text range, even while being composed', () => {
    const docPage = mountPlan(DOCUMENT);
    const figure = docPage.querySelector('doc-figure') as HTMLElement;

    // The label appears verbatim in the composer's own markup. Resolving it as a
    // range would find it there and paint a highlight inside the bucket.
    paintHighlights(docPage, [], {
      pending: { range: itemFor(figure.id).range, scope: 'block' },
    });

    expect(figure.getAttribute('data-doc-commented')).toBe('active');
  });

  it('shows the block’s own text in its detail view', () => {
    const docPage = mountPlan(DOCUMENT);
    const figure = docPage.querySelector('doc-figure') as HTMLElement;

    const view = detailForComment(docPage, itemFor(figure.id), false);

    expect(view.scope).toBe('block');
    expect(view.blockContent).toContain('Boxes');
    expect(view.feedback).toBe('The arrows point the wrong way.');
  });
});

describe('reading a block back', () => {
  it('keeps the line structure of a code block', () => {
    const docPage = mountPlan(DOCUMENT);
    const code = blockText(docPage, (docPage.querySelector('doc-code') as HTMLElement).id);

    expect(code).toContain('const store = createStore(docId);\nconst answer');

    // Everything the runtime added is furniture, however deep it sits. The
    // filename lives at `[data-part=header] > [data-part=title]` and the line
    // numbers at `[data-part=gutter] > [data-part=line-number]`, so testing only
    // the *nearest* named ancestor let both through — the pane opened reading
    // `src/core/base.tsts…` and ended in `}12`.
    expect(code).not.toContain('Copy');
    expect(code).not.toContain('Comment');
    expect(code).not.toContain('store.ts');
    expect(code.trimEnd().endsWith("store.get('answers');")).toBe(true);
  });

  it('leaves out machine-generated style blocks', () => {
    const docPage = mountPlan(
      `<doc-section title="S"><doc-figure type="svg" caption="C">
         <svg viewBox="0 0 1 1"><style>.node { fill: red }</style><title>Real label</title></svg>
       </doc-figure></doc-section>`,
    );

    // Mermaid injects a stylesheet into the SVG it renders; without this the
    // detail view showed several hundred characters of generated CSS.
    const text = blockContentText(docPage.querySelector('doc-figure') as HTMLElement);
    expect(text).toContain('Real label');
    expect(text).not.toContain('fill: red');
  });
});
