/**
 * The selection composer is a preference, not a fixture.
 *
 * The composer opens on every text selection, which is the right default for a
 * reader meeting the document for the first time and the wrong one for anybody
 * reading closely — selecting text is also how people quote, search and re-read.
 * These cover the switch, the ⌘/Ctrl+K shortcut, what survives a reload, and the
 * two routes that MUST keep working while it is off.
 */

import { describe, expect, it } from 'vitest';

import { storeFor } from '../../src/core/store.js';
import { mountPlan, settle } from '../helpers.js';

const DOCUMENT = `
  <doc-section title="What we are building">
    <p id="lede-p">Vendors get told the moment a new order lands, without refreshing anything.</p>
  </doc-section>
  <doc-section title="Diagrams">
    <doc-figure type="svg" caption="Store shape">
      <svg viewBox="0 0 10 10" role="img" aria-label="A box"></svg>
    </doc-figure>
  </doc-section>
`;

/** Select a phrase in the lede exactly as a reader's pointer would. */
function selectPhrase(docPage: HTMLElement, phrase: string): void {
  const paragraph = docPage.querySelector('#lede-p') as HTMLElement;
  const node = paragraph.firstChild as Text;
  const start = node.data.indexOf(phrase);
  expect(start).toBeGreaterThanOrEqual(0);

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + phrase.length);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  // The watcher listens on `document`, so the gesture has to end there too.
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
}

const composerOpen = (): boolean => document.querySelector('[data-part="bucket-popover"]') !== null;

const toggleOf = (docPage: Element): HTMLElement =>
  docPage.querySelector('[data-part="bucket-selection-toggle"]') as HTMLElement;

/** Open the review panel, where the switch lives. */
async function openPanel(docPage: Element): Promise<void> {
  (docPage.querySelector('[data-part="bucket-trigger"]') as HTMLElement).click();
  await settle(50);
}

function pressShortcut(key = 'k', init: KeyboardEventInit = { ctrlKey: true }): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

describe('the selection composer preference', () => {
  it('is on by default, so a first-time reader finds the affordance', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    expect(storeFor(docPage).get('selectionPopup')).toBe(true);

    selectPhrase(docPage, 'the moment a new order lands');
    await settle(50);
    expect(composerOpen()).toBe(true);
  });

  it('stops opening the composer once switched off', async () => {
    const docPage = mountPlan(DOCUMENT);
    await openPanel(docPage);

    toggleOf(docPage).click();
    await settle(50);
    expect(storeFor(docPage).get('selectionPopup')).toBe(false);

    selectPhrase(docPage, 'the moment a new order lands');
    await settle(50);
    expect(composerOpen()).toBe(false);
  });

  it('reports its state on the switch, for assistive tech and for CSS', async () => {
    const docPage = mountPlan(DOCUMENT);
    await openPanel(docPage);

    expect(toggleOf(docPage).getAttribute('aria-pressed')).toBe('true');

    toggleOf(docPage).click();
    await settle(50);
    expect(toggleOf(docPage).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows on the trigger, so a closed panel is not a silent state', async () => {
    // why this is worth a test: the switch lives inside the panel, so with the
    // panel shut the only other evidence that selection commenting is off is
    // selections quietly doing nothing — which reads as a broken document.
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    const mark = (): Element | null => docPage.querySelector('[data-part="bucket-trigger-muted"]');
    expect(mark()).toBeNull();

    pressShortcut();
    await settle(50);
    expect(mark()).not.toBeNull();

    pressShortcut();
    await settle(50);
    expect(mark()).toBeNull();
  });

  it('switches back on, and selections work again', async () => {
    const docPage = mountPlan(DOCUMENT);
    await openPanel(docPage);

    toggleOf(docPage).click();
    await settle(50);
    toggleOf(docPage).click();
    await settle(50);

    expect(storeFor(docPage).get('selectionPopup')).toBe(true);
    selectPhrase(docPage, 'the moment a new order lands');
    await settle(50);
    expect(composerOpen()).toBe(true);
  });
});

describe('the ⌘/Ctrl+K shortcut', () => {
  it('toggles the preference from anywhere in the document', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    pressShortcut();
    await settle(50);
    expect(storeFor(docPage).get('selectionPopup')).toBe(false);

    pressShortcut();
    await settle(50);
    expect(storeFor(docPage).get('selectionPopup')).toBe(true);
  });

  it('accepts the Cmd chord too, so the label matches the behaviour on a Mac', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    pressShortcut('k', { metaKey: true });
    await settle(50);
    expect(storeFor(docPage).get('selectionPopup')).toBe(false);
  });

  it('confirms the change, so a keystroke is never a silent one', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    pressShortcut();
    await settle(50);

    const flash = docPage.querySelector('[data-part="bucket-flash"]');
    expect(flash?.textContent?.trim()).toBe('Selection comments off');
  });

  it('ignores K on its own and chords carrying Alt or Shift', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    pressShortcut('k', {});
    pressShortcut('k', { ctrlKey: true, shiftKey: true });
    pressShortcut('k', { ctrlKey: true, altKey: true });
    await settle(50);

    expect(storeFor(docPage).get('selectionPopup')).toBe(true);
  });

  it('does not discard a comment already being typed', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    selectPhrase(docPage, 'the moment a new order lands');
    await settle(50);

    const draft = document.querySelector('[data-part="bucket-draft"]') as HTMLTextAreaElement;
    draft.value = 'half a thought';
    draft.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(50);

    // A mistyped shortcut mid-sentence must not throw the words away.
    pressShortcut();
    await settle(50);

    expect(storeFor(docPage).get('selectionPopup')).toBe(false);
    expect(composerOpen()).toBe(true);
    expect(draft.value).toBe('half a thought');
  });
});

describe('what stays available while the composer is off', () => {
  it('keeps the block Comment button working', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);
    pressShortcut();
    await settle(50);

    const figureButton = docPage.querySelector('doc-figure [data-part="feedback"]') as HTMLElement;
    expect(figureButton).not.toBeNull();

    figureButton.click();
    await settle(50);

    // why this matters: a diagram has no text to select, so the block button is
    // the *only* way to comment on one. Turning off text selection must not
    // take diagrams and code blocks down with it.
    expect(composerOpen()).toBe(true);
  });

  it('survives a reload, and says so in the empty state', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);
    pressShortcut();
    await settle(400);

    docPage.remove();
    const reopened = mountPlan(DOCUMENT);
    await settle(50);

    expect(storeFor(reopened).get('selectionPopup')).toBe(false);

    await openPanel(reopened);
    const empty = reopened.querySelector('[data-part="bucket-empty"]') as HTMLElement;
    expect(empty.textContent).toContain('is off');
  });
});
