/**
 * The question drawer: the scrape, the write-through, and the trigger.
 *
 * Two things are worth pinning here beyond the obvious.
 *
 * The drawer is built from the live DOM rather than from anything the agent
 * wrote for it (§2.4), so the test that matters most is that a document gains
 * nothing — not one element, not one attribute — by having the feature. If that
 * ever stops being true the feature has started costing generation tokens.
 *
 * And every control writes through the real element rather than to the store,
 * because `doc-choice` owns letter keys, the appended Other option and
 * persistence. A drawer that wrote answers itself would be a second
 * implementation of all of it; these assert that the one implementation is
 * still the one doing the work.
 */

import { describe, expect, it } from 'vitest';

import { storeFor } from '../../src/core/store.js';
import {
  clearAnswer,
  collectQuestions,
  hasQuestions,
  isAnswered,
  isSelected,
  QUESTIONS_OPEN_EVENT,
  selectOption,
  setNote,
  setOtherText,
  setRating,
  unansweredBySection,
  unansweredCount,
} from '../../src/questions/model.js';
import { mountPlan, settle } from '../helpers.js';

const DOCUMENT = `
  <doc-section title="Data model">
    <p>Some prose, so the section is not only a question.</p>
    <doc-choice mode="single" question="Should read state be shared?">
      <doc-option recommended>Yes — shared team inbox<p slot="desc">Simplest.</p></doc-option>
      <doc-option>No — per-person read state<p slot="desc">Needs an extra table.</p></doc-option>
    </doc-choice>
  </doc-section>
  <doc-section title="Delivery">
    <doc-choice mode="multi" question="Which transports should we support?">
      <doc-option>Web push</doc-option>
      <doc-option>APNs</doc-option>
    </doc-choice>
    <doc-rating question="Confidence in the estimate" scale="5"></doc-rating>
  </doc-section>
`;

const state = (docPage: Element) => storeFor(docPage).get('answers');

describe('reading the questions out of a document', () => {
  it('finds every question, in the order the reader meets them', () => {
    const docPage = mountPlan(DOCUMENT);
    const questions = collectQuestions(docPage);

    expect(questions.map((question) => question.question)).toEqual([
      'Should read state be shared?',
      'Which transports should we support?',
      'Confidence in the estimate',
    ]);
    expect(questions.map((question) => question.kind)).toEqual(['choice', 'choice', 'rating']);

    docPage.remove();
  });

  it('carries the number and the mode the document itself shows', () => {
    const docPage = mountPlan(DOCUMENT);
    const [first, second, third] = collectQuestions(docPage);

    // `Q2` here has to be the one the document labels `QUESTION 2`, because
    // `doc-ref to="q-…"` renders that number too. A rating is not numbered
    // anywhere in the document, so it gets a series of its own rather than a
    // question number that means something else three lines away.
    expect(first?.label).toBe('Q1');
    expect(first?.mode).toBe('single');
    expect(second?.label).toBe('Q2');
    expect(second?.mode).toBe('multi');
    expect(third?.label).toBe('R1');

    docPage.remove();
  });

  it('says where each question lives, so the panel can be navigated', () => {
    const docPage = mountPlan(DOCUMENT);
    const questions = collectQuestions(docPage);

    expect(questions[0]?.at).toBe('1 Data model');
    expect(questions[1]?.at).toBe('2 Delivery');

    docPage.remove();
  });

  it('reads option labels and descriptions verbatim, including the appended Other', () => {
    const docPage = mountPlan(DOCUMENT);
    const [first] = collectQuestions(docPage);

    expect(first?.options.map((option) => option.key)).toEqual(['A', 'B', 'O']);
    expect(first?.options[0]?.label).toBe('Yes — shared team inbox');
    expect(first?.options[0]?.description).toBe('Simplest.');
    expect(first?.options[0]?.recommended).toBe(true);
    expect(first?.options[2]?.other).toBe(true);

    docPage.remove();
  });

  it('gives a rating its scale rather than a list of options', () => {
    const docPage = mountPlan(DOCUMENT);
    const rating = collectQuestions(docPage)[2];

    expect(rating?.scale).toEqual([1, 2, 3, 4, 5]);
    expect(rating?.options).toEqual([]);

    docPage.remove();
  });

  /**
   * MUST (§2.4): the panel is derived, not authored. A document that gains one
   * element by supporting it has started paying generation tokens for a feature
   * whose whole justification is that it costs none.
   */
  it('adds nothing to the document it reads', () => {
    const docPage = mountPlan(DOCUMENT);
    const before = docPage.innerHTML;

    collectQuestions(docPage);
    unansweredBySection(docPage, {});

    expect(docPage.innerHTML).toBe(before);

    docPage.remove();
  });

  it('knows when a document asks nothing at all', () => {
    const empty = mountPlan('<doc-section title="Background"><p>Just prose.</p></doc-section>');
    expect(hasQuestions(empty)).toBe(false);
    expect(collectQuestions(empty)).toEqual([]);
    empty.remove();

    const asking = mountPlan(DOCUMENT);
    expect(hasQuestions(asking)).toBe(true);
    asking.remove();
  });
});

describe('answering from the drawer', () => {
  it('selects an option by driving the control the reader would have clicked', async () => {
    const docPage = mountPlan(DOCUMENT);
    const [first] = collectQuestions(docPage);
    const id = first?.id as string;

    selectOption(docPage, id, 'A', true);
    await settle(20);

    // The document, not just the store: the radio a reader scrolls back to has
    // to be the one they picked in the panel.
    const radio = docPage.querySelector<HTMLInputElement>(`#${CSS.escape(id)} input[value="A"]`);
    expect(radio?.checked).toBe(true);
    expect(state(docPage)[id]?.keys).toEqual(['A']);

    docPage.remove();
  });

  it('lets a single-choice question change its mind', async () => {
    const docPage = mountPlan(DOCUMENT);
    const id = collectQuestions(docPage)[0]?.id as string;

    selectOption(docPage, id, 'A', true);
    selectOption(docPage, id, 'B', true);
    await settle(20);

    expect(state(docPage)[id]?.keys).toEqual(['B']);

    docPage.remove();
  });

  it('keeps both answers to a multiple-choice question, and drops one on demand', async () => {
    const docPage = mountPlan(DOCUMENT);
    const id = collectQuestions(docPage)[1]?.id as string;

    selectOption(docPage, id, 'A', true);
    selectOption(docPage, id, 'B', true);
    await settle(20);
    expect(state(docPage)[id]?.keys).toEqual(['A', 'B']);

    selectOption(docPage, id, 'A', false);
    await settle(20);
    expect(state(docPage)[id]?.keys).toEqual(['B']);

    docPage.remove();
  });

  it('writes the Other text into the field the document shows', async () => {
    const docPage = mountPlan(DOCUMENT);
    const id = collectQuestions(docPage)[0]?.id as string;

    selectOption(docPage, id, 'O', true);
    setOtherText(docPage, id, 'A third option nobody listed.');
    await settle(20);

    const field = docPage.querySelector<HTMLTextAreaElement>(
      `#${CSS.escape(id)} [data-part="other-text"]`,
    );
    expect(field?.value).toBe('A third option nobody listed.');
    expect(state(docPage)[id]?.otherText).toBe('A third option nobody listed.');

    docPage.remove();
  });

  /**
   * The note field is hidden behind a toggle in the document, so a note typed in
   * the panel would otherwise be written into a box the reader cannot see — and
   * would look, on scrolling back, exactly like it had been lost.
   */
  it('opens the note field in the document when it writes to it', async () => {
    const docPage = mountPlan(DOCUMENT);
    const choice = docPage.querySelector('doc-choice') as HTMLElement;
    const id = choice.id;

    expect(choice.querySelector('[data-part="note-toggle"]')?.getAttribute('aria-expanded')).toBe(
      'false',
    );

    setNote(docPage, id, 'Only if the team is smaller than five.');
    await settle(20);

    expect(choice.querySelector('[data-part="note-toggle"]')?.getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(state(docPage)[id]?.note).toBe('Only if the team is smaller than five.');

    docPage.remove();
  });

  it('presses the score a rating would have been given by hand', async () => {
    const docPage = mountPlan(DOCUMENT);
    const id = collectQuestions(docPage)[2]?.id as string;

    setRating(docPage, id, 4);
    await settle(20);

    expect(state(docPage)[id]?.keys).toEqual(['4']);
    expect(
      docPage
        .querySelector(`#${CSS.escape(id)} [data-part="score-btn"][data-score="4"]`)
        ?.getAttribute('aria-checked'),
    ).toBe('true');

    docPage.remove();
  });

  it('clears the controls as well as the answer', async () => {
    const docPage = mountPlan(DOCUMENT);
    const id = collectQuestions(docPage)[0]?.id as string;

    selectOption(docPage, id, 'A', true);
    setNote(docPage, id, 'Worth revisiting.');
    await settle(20);

    clearAnswer(docPage, id);
    await settle(20);

    // A store entry alone would leave the radio visibly checked, which is the
    // bug a reader reports as "Clear did nothing".
    expect(
      docPage.querySelector<HTMLInputElement>(`#${CSS.escape(id)} input[value="A"]`)?.checked,
    ).toBe(false);
    expect(state(docPage)[id]?.keys).toEqual([]);
    expect(state(docPage)[id]?.note).toBeUndefined();

    docPage.remove();
  });
});

describe('counting what is still open', () => {
  it('counts a question as answered once anything is selected', async () => {
    const docPage = mountPlan(DOCUMENT);
    const store = storeFor(docPage);
    const questions = collectQuestions(docPage);

    expect(unansweredCount(store.get('answers'), questions)).toBe(3);

    selectOption(docPage, questions[0]?.id as string, 'A', true);
    await settle(20);

    const after = store.get('answers');
    expect(isAnswered(after, questions[0]?.id as string)).toBe(true);
    expect(unansweredCount(after, questions)).toBe(2);

    docPage.remove();
  });

  it('attributes each question to the section it is written in', () => {
    const docPage = mountPlan(DOCUMENT);
    const counts = unansweredBySection(docPage, {});

    expect(counts.get('sec-data-model')).toBe(1);
    expect(counts.get('sec-delivery')).toBe(2);

    docPage.remove();
  });

  it('counts a note with no selection as an answer, because the reader said something', () => {
    expect(isAnswered({ 'q-x': { keys: [], note: 'Neither of these.' } }, 'q-x')).toBe(true);
  });
});

describe('the contents panel’s question trigger', () => {
  const trigger = (docPage: Element) =>
    docPage.querySelector<HTMLElement>('doc-toc [data-part="questions"]');

  it('appears with the number of questions still open', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(20);

    const button = trigger(docPage);
    expect(button).not.toBeNull();
    expect(button?.dataset.state).toBe('open');
    expect(button?.querySelector('[data-part="questions-count"]')?.textContent).toBe('3');

    docPage.remove();
  });

  it('counts down as the reader answers, and goes quiet at zero', async () => {
    const docPage = mountPlan(
      `<doc-section title="Only one">
         <doc-choice question="Ship it?"><doc-option>Yes</doc-option><doc-option>No</doc-option></doc-choice>
       </doc-section>`,
    );
    await settle(20);

    const id = (docPage.querySelector('doc-choice') as HTMLElement).id;
    selectOption(docPage, id, 'A', true);
    await settle(20);

    const button = trigger(docPage);
    expect(button?.dataset.state).toBe('done');
    expect(button?.querySelector('[data-part="questions-count"]')?.hasAttribute('hidden')).toBe(
      true,
    );

    docPage.remove();
  });

  it('marks the outline entries whose sections have open questions', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(20);

    const entries = Array.from(
      docPage.querySelectorAll<HTMLElement>('doc-toc [data-part="entry"]'),
    );
    const marks = entries.map(
      (entry) => entry.querySelector('[data-part="entry-questions"]')?.textContent,
    );

    expect(marks).toEqual(['1', '2']);
    expect(entries.every((entry) => entry.hasAttribute('data-has-questions'))).toBe(true);

    docPage.remove();
  });

  it('is absent from a document that asks nothing', async () => {
    const docPage = mountPlan('<doc-section title="Background"><p>Just prose.</p></doc-section>');
    await settle(20);

    expect(trigger(docPage)).toBeNull();
    // The panel itself still lists the section — only the trigger goes.
    expect(docPage.querySelector('doc-toc [data-part="entry"]')).not.toBeNull();

    docPage.remove();
  });

  it('dispatches the one event the drawer listens for', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(20);

    const seen: Event[] = [];
    docPage.addEventListener(QUESTIONS_OPEN_EVENT, (event) => seen.push(event));
    trigger(docPage)?.click();

    expect(seen).toHaveLength(1);

    docPage.remove();
  });
});

describe('the drawer itself', () => {
  it('opens on the event, renders every question whole, and closes again', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    docPage.dispatchEvent(new CustomEvent(QUESTIONS_OPEN_EVENT, { bubbles: true }));
    await settle(50);

    const drawer = document.querySelector<HTMLDialogElement>('[data-part="question-drawer"]');
    expect(drawer?.open).toBe(true);

    // Whole, not a list of titles: the reader has to be able to answer here.
    expect(drawer?.querySelectorAll('[data-part="question-card"]')).toHaveLength(3);
    expect(drawer?.textContent).toContain('Should read state be shared?');
    expect(drawer?.textContent).toContain('Yes — shared team inbox');
    expect(drawer?.textContent).toContain('Simplest.');
    expect(drawer?.textContent).toContain('0 of 3 answered');

    // The note is behind a toggle here, exactly as it is in the document: an
    // open field on every card reads as a form rather than a list of decisions.
    expect(drawer?.querySelector('[data-part="question-card-note"]')).toBeNull();
    expect(
      drawer
        ?.querySelector('[data-part="question-card-note-toggle"]')
        ?.getAttribute('aria-expanded'),
    ).toBe('false');

    drawer?.querySelector<HTMLElement>('[data-part="question-drawer-close"]')?.click();
    await settle(50);
    expect(drawer?.open).toBe(false);

    docPage.remove();
  });

  it('opens the note on request, and on load when one was already written', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    docPage.dispatchEvent(new CustomEvent(QUESTIONS_OPEN_EVENT, { bubbles: true }));
    await settle(50);

    const drawer = document.querySelector('[data-part="question-drawer"]') as HTMLElement;
    drawer.querySelector<HTMLElement>('[data-part="question-card-note-toggle"]')?.click();
    await settle(50);

    const field = drawer.querySelector<HTMLTextAreaElement>('[data-part="question-card-note"]');
    expect(field).not.toBeNull();

    field?.dispatchEvent(new Event('input', { bubbles: true }));
    if (field) field.value = 'Depends on team size.';
    field?.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(50);

    // Reopen: a note the reader already wrote is never hidden from them.
    drawer.querySelector<HTMLElement>('[data-part="question-drawer-close"]')?.click();
    await settle(50);
    docPage.dispatchEvent(new CustomEvent(QUESTIONS_OPEN_EVENT, { bubbles: true }));
    await settle(50);

    expect(drawer.querySelector('[data-part="question-card-note"]')).not.toBeNull();

    docPage.remove();
  });

  it('answers the document from inside the panel', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    docPage.dispatchEvent(new CustomEvent(QUESTIONS_OPEN_EVENT, { bubbles: true }));
    await settle(50);

    const drawer = document.querySelector('[data-part="question-drawer"]') as HTMLElement;
    const option = drawer.querySelector<HTMLInputElement>(
      '[data-part="question-card"] [data-part="question-card-option"] input',
    );
    option?.click();
    await settle(50);

    const id = (docPage.querySelector('doc-choice') as HTMLElement).id;
    expect(state(docPage)[id]?.keys).toEqual(['A']);
    expect(isSelected(state(docPage), id, 'A')).toBe(true);

    // And the count in the panel's own header moved with it.
    expect(drawer.textContent).toContain('1 of 3 answered');

    docPage.remove();
  });

  /**
   * A radio group is scoped to the document, so a panel that reused
   * `<id>-answer` would put its inputs in the *same* group as the page's. The
   * reader's click would silently uncheck the real radio without firing
   * `change` on it, and the answer would never be persisted.
   */
  it('keeps its radios out of the document’s own groups', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    docPage.dispatchEvent(new CustomEvent(QUESTIONS_OPEN_EVENT, { bubbles: true }));
    await settle(50);

    const id = (docPage.querySelector('doc-choice') as HTMLElement).id;
    const inPanel = document.querySelector<HTMLInputElement>(
      '[data-part="question-card-option"] input',
    );

    expect(inPanel?.name).not.toBe(`${id}-answer`);

    docPage.remove();
  });

  it('hides the answered questions on request', async () => {
    const docPage = mountPlan(DOCUMENT);
    await settle(50);

    const id = (docPage.querySelector('doc-choice') as HTMLElement).id;
    selectOption(docPage, id, 'A', true);
    await settle(20);

    docPage.dispatchEvent(new CustomEvent(QUESTIONS_OPEN_EVENT, { bubbles: true }));
    await settle(50);

    const drawer = document.querySelector('[data-part="question-drawer"]') as HTMLElement;
    drawer.querySelector<HTMLElement>('[data-part="question-drawer-filter"]')?.click();
    await settle(50);

    expect(drawer.querySelectorAll('[data-part="question-card"]')).toHaveLength(2);

    docPage.remove();
  });
});
