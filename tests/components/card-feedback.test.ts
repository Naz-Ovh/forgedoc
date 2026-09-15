/**
 * The Comment button on a card.
 *
 * `block-feedback.test.ts` covers the blocks that got this first — a diagram,
 * an image, a code block — where the argument was that there is no text to
 * select. This file covers the cards, where the argument is different: there is
 * plenty of text, but the unit a reader disagrees with is the whole card. A
 * question whose options miss the real case, a callout whose claim is wrong, a
 * step in the wrong order — none of those objections are about a sentence, and
 * making the reader rubber-band one to say so is a fiddly drag that lands on
 * the wrong boundary.
 *
 * Selecting text inside a card still makes an ordinary text comment. The two
 * live side by side because they answer different questions, which is the whole
 * distinction these tests exist to hold.
 */

import { describe, expect, it } from 'vitest';

import { BLOCK_FEEDBACK_EVENT, blockContentText } from '../../src/core/feedback.js';
import { storeFor } from '../../src/core/store.js';
import { authorNodesOf, mountPlan, mountTwice, settle } from '../helpers.js';

/** One of each card that carries the affordance. */
const DOCUMENT = `
  <doc-section title="The shape of it">
    <doc-note kind="warn" title="Tokens expire">
      A token FCM reports as <code>UNREGISTERED</code> must be pruned.
    </doc-note>

    <doc-collapse title="Why not a second table">
      Bare prose, no element of its own.
    </doc-collapse>

    <doc-choice mode="single" question="Should read state be shared?">
      <doc-option recommended>Yes — shared team inbox<p slot="desc">Simplest.</p></doc-option>
      <doc-option>No — per-person read state</doc-option>
    </doc-choice>

    <doc-steps>
      <doc-step title="Customer feed API">Mirror of <code>admin-routes.ts</code>.</doc-step>
    </doc-steps>

    <doc-timeline>
      <doc-milestone date="2026-Q3" title="Production launch">Needs the Apple account.</doc-milestone>
    </doc-timeline>

    <doc-stats>
      <doc-stat label="Target P99" value="&lt; 45ms">Measured at the edge.</doc-stat>
    </doc-stats>

    <doc-decision id="ADR-001" title="Database choice" status="accepted">
      Postgres, for the NOTIFY channel.
    </doc-decision>

    <doc-blocker severity="high" title="SSE loses CORS headers">
      <doc-blocks>The stream never updates.</doc-blocks>
      <doc-why>The route takes over the raw connection.</doc-why>
      <doc-action>The route writes the headers itself.</doc-action>
    </doc-blocker>

    <doc-roadmap>
      <doc-stage title="Ingestion" subtitle="2 weeks"><p>Body.</p></doc-stage>
    </doc-roadmap>
  </doc-section>
`;

/** Every card the affordance is meant to be on. */
const CARDS = [
  'doc-note',
  'doc-collapse',
  'doc-choice',
  'doc-step',
  'doc-milestone',
  'doc-stat',
  'doc-decision',
  'doc-blocker',
  'doc-stage',
];

const buttonIn = (docPage: Element, tag: string): HTMLElement | null =>
  docPage.querySelector<HTMLElement>(`${tag} > [data-part="feedback"]`);

describe('the Comment button on a card', () => {
  it('is on every card a reader might disagree with as a whole', () => {
    const docPage = mountPlan(DOCUMENT);

    for (const tag of CARDS) {
      expect(buttonIn(docPage, tag), `${tag} has no Comment button`).not.toBeNull();
    }

    docPage.remove();
  });

  it('is an icon, not the word, because it floats over content it must not crowd', () => {
    const docPage = mountPlan(DOCUMENT);
    const button = buttonIn(docPage, 'doc-note') as HTMLElement;

    expect(button.querySelector('[data-part="comment-icon"]')).not.toBeNull();
    expect(button.textContent?.trim()).toBe('');
    // The name has to survive the word going, or the button is unlabelled.
    expect(button.getAttribute('aria-label')).toBe('Comment on doc-note · Tokens expire');

    docPage.remove();
  });

  /**
   * The corner placement is driven by a marker on the host rather than by a
   * stylesheet listing every commentable tag — which is what lets a tenth card
   * join the set without a CSS change in any of the four themes.
   */
  it('marks its host so one rule positions all of them', () => {
    const docPage = mountPlan(DOCUMENT);

    for (const tag of CARDS) {
      expect(docPage.querySelector(tag)?.getAttribute('data-doc-feedback'), tag).toBe('corner');
    }

    // A block with a header row of its own puts the button in it instead, and
    // is not marked — the rules that float a corner button must not match it.
    const withHeader = mountPlan(
      '<doc-section title="S"><doc-code lang="ts" title="store.ts">const a = 1;</doc-code></doc-section>',
    );
    expect(withHeader.querySelector('doc-code')?.hasAttribute('data-doc-feedback')).toBe(false);
    expect(
      withHeader.querySelector('doc-code [data-part="header"] [data-part="feedback"]'),
    ).not.toBeNull();

    docPage.remove();
    withHeader.remove();
  });

  it('is chrome, so it never counts as author content', () => {
    const docPage = mountPlan(DOCUMENT);

    for (const tag of CARDS) {
      expect(buttonIn(docPage, tag)?.dataset.docChrome, tag).toBe('');
    }

    docPage.remove();
  });

  /** MUST (§2.2): appending chrome may not disturb one author node. */
  it('moves nothing the agent wrote', () => {
    const docPage = mountPlan(DOCUMENT);
    const authored = authorNodesOf(docPage).map((node) => node.textContent);

    const again = mountPlan(DOCUMENT);
    expect(authorNodesOf(again).map((node) => node.textContent)).toEqual(authored);

    docPage.remove();
    again.remove();
  });

  it('is appended once, however many times the runtime runs', () => {
    const docPage = mountTwice(DOCUMENT);

    for (const tag of CARDS) {
      expect(docPage.querySelectorAll(`${tag} > [data-part="feedback"]`).length, tag).toBe(1);
    }

    docPage.remove();
  });

  it('carries the card’s own name, so the bucket says what was commented on', () => {
    const docPage = mountPlan(DOCUMENT);
    const seen: string[] = [];
    docPage.addEventListener(BLOCK_FEEDBACK_EVENT, (event) =>
      seen.push((event as CustomEvent).detail.label),
    );

    buttonIn(docPage, 'doc-choice')?.click();
    buttonIn(docPage, 'doc-step')?.click();
    buttonIn(docPage, 'doc-stat')?.click();

    expect(seen).toEqual([
      'doc-choice · Should read state be shared?',
      'doc-step · Customer feed API',
      'doc-stat · Target P99',
    ]);

    docPage.remove();
  });

  /**
   * A card is usually something a click already means something to: an option
   * row selects itself, a disclosure summary opens. Without this the Comment
   * button also answered the question it was attached to.
   */
  it('does not also trigger whatever the card does when clicked', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(20);

    const collapse = docPage.querySelector('doc-collapse') as HTMLElement;
    const openBefore = collapse.querySelector('[data-part="body"]')?.hasAttribute('hidden');

    buttonIn(docPage, 'doc-collapse')?.click();
    buttonIn(docPage, 'doc-choice')?.click();
    await settle(20);

    expect(collapse.querySelector('[data-part="body"]')?.hasAttribute('hidden')).toBe(openBefore);
    expect(storeFor(docPage).get('answers')).toEqual({});

    docPage.remove();
  });
});

describe('reading a card back', () => {
  it('quotes the question and its answers, not the runtime’s own defaults', () => {
    const docPage = mountPlan(DOCUMENT);
    const text = blockContentText(docPage.querySelector('doc-choice') as HTMLElement);

    expect(text).toContain('Should read state be shared?');
    expect(text).toContain('Yes — shared team inbox');
    expect(text).toContain('No — per-person read state');

    // All of this is appended by the runtime, and none of it is anything the
    // reader is commenting on: the sequence label, the letter badges, the note
    // toggle and the always-appended Other option.
    expect(text).not.toContain('QUESTION 1');
    expect(text).not.toContain('Add a note');
    expect(text).not.toContain('type your own solution');
    expect(text).not.toMatch(/(^|\s)A(\s|$)/);

    docPage.remove();
  });

  it('quotes a callout as its title and its body', () => {
    const docPage = mountPlan(DOCUMENT);
    const text = blockContentText(docPage.querySelector('doc-note') as HTMLElement);

    expect(text).toContain('Tokens expire');
    expect(text).toContain('UNREGISTERED');

    docPage.remove();
  });

  it('leaves a step’s generated number out of its own text', () => {
    const docPage = mountPlan(DOCUMENT);
    const text = blockContentText(docPage.querySelector('doc-step') as HTMLElement);

    expect(text).toContain('Customer feed API');
    expect(text).toContain('admin-routes.ts');

    docPage.remove();
  });
});

describe('a comment made from a card', () => {
  it('is stored against the element rather than a range inside it', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    buttonIn(docPage, 'doc-note')?.click();
    await settle(50);

    const draft = docPage.querySelector('[data-part="bucket-draft"]') as HTMLTextAreaElement;
    draft.value = 'Pruning happens where?';
    draft.dispatchEvent(new Event('input', { bubbles: true }));
    (docPage.querySelector('[data-part="bucket-save"]') as HTMLElement).click();
    await settle(50);

    const stored = storeFor(docPage).get('feedback');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.scope).toBe('block');
    expect(stored[0]?.range.anchorId).toBe((docPage.querySelector('doc-note') as HTMLElement).id);

    docPage.remove();
  });

  /**
   * A question already has a *note* field, and the two are not the same thing.
   * The note travels in the bucket as part of the answer; this is an objection
   * to the question as written, which a reader who cannot answer it has no
   * answer to attach a note to.
   */
  it('is separate from the note on a question’s answer', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    const choice = docPage.querySelector('doc-choice') as HTMLElement;
    expect(choice.querySelector('[data-part="note"]')).not.toBeNull();
    expect(choice.querySelector(':scope > [data-part="feedback"]')).not.toBeNull();

    buttonIn(docPage, 'doc-choice')?.click();
    await settle(50);

    const draft = docPage.querySelector('[data-part="bucket-draft"]') as HTMLTextAreaElement;
    draft.value = 'Neither option covers a per-team default.';
    draft.dispatchEvent(new Event('input', { bubbles: true }));
    (docPage.querySelector('[data-part="bucket-save"]') as HTMLElement).click();
    await settle(50);

    const store = storeFor(docPage);
    expect(store.get('feedback')[0]?.comment).toBe('Neither option covers a per-team default.');
    // Commenting is not answering. The question is still open.
    expect(store.get('answers')[choice.id]).toBeUndefined();

    docPage.remove();
  });
});
