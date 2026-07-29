/**
 * `plan-choice` — the component that carries the most derived behaviour, and so
 * the one with the most that can silently regress.
 */

import { describe, expect, it } from 'vitest';

import { collectBucket } from '../../src/bucket/collect.js';
import { serializeBucket } from '../../src/bucket/serialize.js';
import { storeFor } from '../../src/core/store.js';
import type { PlanState } from '../../src/core/types.js';
import { mountPlan, settle } from '../helpers.js';

const QUESTION = `
  <plan-choice mode="single" question="Should read state be shared across the team?">
    <plan-option recommended>
      Yes — shared team inbox
      <p slot="desc">"Unread" means nobody handled it yet.</p>
    </plan-option>
    <plan-option>
      No — each person has their own read state
      <p slot="desc">Needs an extra table.</p>
    </plan-option>
  </plan-choice>
`;

const stateOf = (planDoc: Element): PlanState => {
  const store = storeFor(planDoc);
  return {
    version: 1,
    planId: store.get('planId'),
    answers: store.get('answers'),
    feedback: store.get('feedback'),
    collapse: store.get('collapse'),
    tabs: store.get('tabs'),
    checks: store.get('checks'),
    toc: store.get('toc'),
  };
};

describe('derived chrome', () => {
  it('derives the id from the question', () => {
    const planDoc = mountPlan(QUESTION);
    expect(planDoc.querySelector('plan-choice')?.id).toBe(
      'q-should-read-state-be-shared-across-the-team',
    );
  });

  it('labels the sequence and the mode', () => {
    const planDoc = mountPlan(QUESTION);
    expect(planDoc.querySelector('[data-part="sequence"]')?.textContent).toBe(
      'QUESTION 1 · SINGLE CHOICE',
    );
  });

  it('renders the question text the author wrote as an attribute', () => {
    const planDoc = mountPlan(QUESTION);
    expect(planDoc.querySelector('[data-part="question"]')?.textContent).toBe(
      'Should read state be shared across the team?',
    );
  });

  /*
   * MUST (§7.3): ARIA comes from ElementInternals, so no `role=` or `aria-*`
   * attribute is ever written into the markup. `internals.role` has no public
   * reader, so the observable consequences are what get asserted: the attribute
   * stays absent, and the control type follows `mode`.
   */
  it('carries ARIA on internals rather than in markup', () => {
    const single = mountPlan(QUESTION);
    const choice = single.querySelector('plan-choice') as HTMLElement;

    expect(choice.getAttribute('role')).toBeNull();
    expect(choice.getAttributeNames().filter((name) => name.startsWith('aria-'))).toEqual([]);
    expect(single.querySelector('input')?.type).toBe('radio');
    single.remove();

    const multi = mountPlan(QUESTION.replace('mode="single"', 'mode="multi"'));
    expect(multi.querySelector('input')?.type).toBe('checkbox');
  });

  it('names each control from the author’s own label text', () => {
    const planDoc = mountPlan(QUESTION);
    const input = planDoc.querySelector('input') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe('Yes — shared team inbox');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('appends the Other option with its textarea inside the block', () => {
    const planDoc = mountPlan(QUESTION);
    const other = planDoc.querySelector('plan-option[data-part="other"]');

    expect(other).not.toBeNull();
    expect((other as HTMLElement).dataset.key).toBe('O');
    // MUST (§8.4): the textarea is a child of the Other option, never a stray
    // field below the list.
    expect(other?.querySelector('textarea[data-part="other-text"]')).not.toBeNull();
    expect(other?.querySelector('[data-part="other-label"]')?.textContent).toBe(
      'Other — type your own solution',
    );
    expect(other?.querySelector('[data-part="other-hint"]')).not.toBeNull();
  });

  it('uses a textarea, never a single-line input, for every free-text field', () => {
    const planDoc = mountPlan(QUESTION);
    const choice = planDoc.querySelector('plan-choice') as HTMLElement;

    const textInputs = Array.from(choice.querySelectorAll('input')).filter(
      (input) => input.type !== 'radio' && input.type !== 'checkbox',
    );
    expect(textInputs).toEqual([]);
    expect(choice.querySelectorAll('textarea').length).toBe(2);
  });

  it('hides the note behind a toggle, with a placeholder that says it is a comment', () => {
    const planDoc = mountPlan(QUESTION);
    const choice = planDoc.querySelector('plan-choice') as HTMLElement;

    expect(choice.matches(':state(note-open)')).toBe(false);
    expect(choice.querySelector('[data-part="note-toggle"]')?.textContent).toBe('＋ Add a note');
    expect(choice.querySelector<HTMLTextAreaElement>('[data-part="note"]')?.placeholder).toContain(
      'not a second answer',
    );

    (choice.querySelector('[data-part="note-toggle"]') as HTMLElement).click();
    expect(choice.matches(':state(note-open)')).toBe(true);
  });

  it('marks options with recommended, and never with disabled', () => {
    const planDoc = mountPlan(QUESTION);

    expect(planDoc.querySelector('[data-part="recommended"]')?.textContent).toBe('Recommended');
    expect(planDoc.querySelectorAll('[disabled]')).toHaveLength(0);
  });

  it('keeps the option label a direct author text node', () => {
    const planDoc = mountPlan(QUESTION);
    const firstOption = planDoc.querySelector('plan-option') as HTMLElement;

    const directText = Array.from(firstOption.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim())
      .filter(Boolean);

    expect(directText.join(' ')).toContain('Yes — shared team inbox');
  });
});

describe('answering', () => {
  it('persists a selection and restores it after a remount', async () => {
    const planDoc = mountPlan(QUESTION);
    const input = planDoc.querySelector('input') as HTMLInputElement;

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    const choice = planDoc.querySelector('plan-choice') as HTMLElement;
    expect(choice.matches(':state(answered)')).toBe(true);
    expect(storeFor(planDoc).get('answers')[choice.id]?.keys).toEqual(['A']);
    planDoc.remove();

    const reloaded = mountPlan(QUESTION);
    const restored = reloaded.querySelector('input') as HTMLInputElement;
    expect(restored.checked).toBe(true);
  });

  it('auto-reveals the note when it holds restored text', async () => {
    const planDoc = mountPlan(QUESTION);
    const note = planDoc.querySelector('[data-part="note"]') as HTMLTextAreaElement;

    note.value = 'only if we can still see who read it';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    planDoc.remove();

    const reloaded = mountPlan(QUESTION);
    const choice = reloaded.querySelector('plan-choice') as HTMLElement;
    expect(choice.matches(':state(note-open)')).toBe(true);
    expect(reloaded.querySelector<HTMLTextAreaElement>('[data-part="note"]')?.value).toBe(
      'only if we can still see who read it',
    );
  });

  it('reveals the Other textarea only when Other is selected', () => {
    const planDoc = mountPlan(QUESTION);
    const choice = planDoc.querySelector('plan-choice') as HTMLElement;
    const otherInput = choice.querySelector(
      'plan-option[data-part="other"] input',
    ) as HTMLInputElement;

    expect(choice.matches(':state(other-open)')).toBe(false);
    otherInput.checked = true;
    otherInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(choice.matches(':state(other-open)')).toBe(true);
  });

  it('records every selection in multi mode', async () => {
    const planDoc = mountPlan(QUESTION.replace('mode="single"', 'mode="multi"'));
    const boxes = Array.from(planDoc.querySelectorAll('input'));

    for (const box of boxes.slice(0, 2)) {
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await settle();

    const choice = planDoc.querySelector('plan-choice') as HTMLElement;
    expect(storeFor(planDoc).get('answers')[choice.id]?.keys).toEqual(['A', 'B']);
  });
});

describe('serialising an answer', () => {
  it('carries the question and the chosen label verbatim into the bucket', async () => {
    const planDoc = mountPlan(QUESTION);
    const input = planDoc.querySelector('input') as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    const text = serializeBucket(collectBucket(planDoc, stateOf(planDoc), '2026-01-01T00:00:00Z'));

    expect(text).toContain('q: Should read state be shared across the team?');
    expect(text).toContain('a: Yes — shared team inbox');
  });

  /* §10.3: an Other answer serialises the reader's typed text as the label. */
  it('serialises the reader’s own words for an Other answer', async () => {
    const planDoc = mountPlan(QUESTION);
    const choice = planDoc.querySelector('plan-choice') as HTMLElement;
    const otherInput = choice.querySelector(
      'plan-option[data-part="other"] input',
    ) as HTMLInputElement;
    const otherText = choice.querySelector('[data-part="other-text"]') as HTMLTextAreaElement;

    otherInput.checked = true;
    otherInput.dispatchEvent(new Event('change', { bubbles: true }));
    otherText.value = 'split it into two endpoints instead';
    otherText.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();

    const text = serializeBucket(collectBucket(planDoc, stateOf(planDoc), '2026-01-01T00:00:00Z'));
    expect(text).toContain('a: split it into two endpoints instead');
  });
});
