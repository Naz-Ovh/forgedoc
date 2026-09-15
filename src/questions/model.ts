/**
 * The question drawer's view model: read the live document, drive the live
 * document.
 *
 * why the drawer is scraped rather than authored (§2.4): the whole point of
 * this library is that a plan costs ~4,000 generation tokens. A feature that
 * asked the agent to emit a second copy of every question — for a side panel
 * that only exists to *find* them — would put the token budget straight back
 * where it was. Everything here reads from the DOM the agent already wrote, at
 * the moment the reader opens the panel, so the feature costs zero tokens per
 * document and can never fall out of sync with the questions it lists.
 *
 * why it writes through the real elements rather than to the store: `doc-choice`
 * owns letter keys, the appended Other option, the note field and persistence.
 * A drawer that wrote answers straight to the store would be a second
 * implementation of all of it, and the two would disagree the first time either
 * changed. So the drawer is a remote control: every edit sets the value on the
 * element the reader would otherwise have clicked and dispatches the event that
 * element is already listening for. `doc-choice` then persists exactly as it
 * does for a click in the document, and the store notifies the drawer back.
 */

import { optionLabel, optionValue } from '../components/doc-option.js';
import type { StoredAnswer } from '../core/types.js';

/**
 * Bubbles from the contents panel's trigger to `doc-page`, where the drawer
 * picks it up.
 *
 * why an event rather than a method call: `doc-toc` is a vanilla custom element
 * and the drawer is a Svelte component mounted by `doc-page`. Neither should
 * hold a reference to the other, and this way a second trigger — a keyboard
 * shortcut, a link in a note — costs one `dispatchEvent`.
 */
export const QUESTIONS_OPEN_EVENT = 'forgedoc:questions-open';

/** Tags that ask the reader something. Document order is the drawer's order. */
const QUESTION_SELECTOR = 'doc-choice, doc-rating';

/** True when `docPage` asks the reader anything at all. */
export function hasQuestions(docPage: Element): boolean {
  return docPage.querySelector(QUESTION_SELECTOR) !== null;
}

/** One answer a reader can pick, as the drawer renders it. */
export interface QuestionOption {
  /** Derived letter key: `A`, `B`, … or `O` for the appended Other. */
  readonly key: string;
  /** What gets persisted — the author's `value` override, or the letter. */
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly recommended: boolean;
  /** True for the runtime's appended Other option, which owns a textarea. */
  readonly other: boolean;
}

/** One question, flattened for rendering. */
export interface QuestionView {
  readonly id: string;
  readonly kind: 'choice' | 'rating';
  /**
   * The label the document itself uses for this question: `Q3` for a choice,
   * `R1` for a rating.
   *
   * why not one sequence over both: `doc-choice` renders `QUESTION 3` in the
   * document and `doc-ref to="q-…"` resolves to the same number, so a panel
   * that renumbered them would be the only place in the document where
   * "question 3" meant something else. A rating has no number of its own
   * anywhere, so it gets a series that cannot be mistaken for one.
   */
  readonly label: string;
  readonly question: string;
  readonly mode: 'single' | 'multi';
  /** Human-readable location, e.g. `3.1 Data model`. Empty when unknown. */
  readonly at: string;
  readonly options: readonly QuestionOption[];
  /** Rating only: the scores on offer, `1…n`. Empty for a choice. */
  readonly scale: readonly number[];
}

/** Every question in the document, in the order a reader meets them. */
export function collectQuestions(docPage: Element): QuestionView[] {
  const views: QuestionView[] = [];
  let choiceNumber = 0;
  let ratingNumber = 0;

  for (const element of Array.from(docPage.querySelectorAll<HTMLElement>(QUESTION_SELECTOR))) {
    const rating = element.tagName.toLowerCase() === 'doc-rating';
    if (rating) ratingNumber += 1;
    else choiceNumber += 1;

    views.push({
      id: element.id,
      kind: rating ? 'rating' : 'choice',
      // `doc-choice` publishes its own number as `data-number` so `doc-ref` can
      // read it; matching it here is what makes "Question 3" mean one thing.
      label: rating ? `R${ratingNumber}` : `Q${Number(element.dataset.number) || choiceNumber}`,
      question: element.getAttribute('question')?.trim() ?? '',
      mode: element.getAttribute('mode') === 'multi' ? 'multi' : 'single',
      at: locationOf(element),
      options: rating ? [] : optionsOf(element),
      scale: rating ? scaleOf(element) : [],
    });
  }

  return views;
}

/** `3.1 Data model` for whatever section a question lives in. */
function locationOf(element: Element): string {
  const section = element.closest('doc-section');
  if (!section) return '';

  const number = section.getAttribute('data-number') ?? '';
  const title = section.getAttribute('title') ?? '';
  return `${number} ${title}`.trim();
}

function optionsOf(choice: Element): QuestionOption[] {
  return Array.from(choice.querySelectorAll<HTMLElement>(':scope > doc-option')).map((option) => {
    const other = option.dataset.part === 'other';
    const key = option.dataset.key ?? '';

    return {
      key,
      value: optionValue(option, key),
      // The Other option's own label is runtime boilerplate; the drawer draws
      // its own, so reading it back would only put the same sentence twice.
      label: other ? 'Other — type your own answer' : optionLabel(option),
      description: other ? '' : (descriptionOf(option) ?? ''),
      recommended: option.hasAttribute('recommended'),
      other,
    };
  });
}

function descriptionOf(option: Element): string | undefined {
  const description = option.querySelector<HTMLElement>(
    ':scope > [data-part="desc"], :scope > [slot="desc"]',
  );
  return description?.textContent?.replace(/\s+/g, ' ').trim();
}

function scaleOf(rating: Element): number[] {
  const buttons = rating.querySelectorAll('[data-part="score-btn"]');
  const count =
    buttons.length || Math.max(3, Math.min(10, Number(rating.getAttribute('scale')) || 5));
  return Array.from({ length: count }, (_, index) => index + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading the answers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The store's answer map, which is all of `DocState` any of this needs.
 *
 * why not the whole state: nothing here reads `feedback`, `collapse` or the TOC
 * preference, and taking the narrower type means the drawer re-renders on an
 * answer changing rather than on any part of the document state changing.
 */
export type AnswerMap = Readonly<Record<string, StoredAnswer>>;

/** True when the reader has selected something, or typed a note. */
export function isAnswered(answers: AnswerMap, id: string): boolean {
  const stored = answers[id];
  if (!stored) return false;
  return stored.keys.length > 0 || Boolean(stored.note?.trim());
}

/** How many of `questions` are still open. Drives the trigger's badge. */
export function unansweredCount(answers: AnswerMap, questions: readonly QuestionView[]): number {
  return questions.filter((question) => !isAnswered(answers, question.id)).length;
}

/**
 * Unanswered questions per section id, for the contents panel.
 *
 * why keyed by the *nearest* section rather than by every ancestor: a top-level
 * section that contains three subsections would otherwise claim their questions
 * as well, and every entry above a question would light up — which tells the
 * reader nothing they did not already know from the document being long.
 */
export function unansweredBySection(docPage: Element, answers: AnswerMap): Map<string, number> {
  const counts = new Map<string, number>();

  for (const element of Array.from(docPage.querySelectorAll<HTMLElement>(QUESTION_SELECTOR))) {
    const section = element.closest('doc-section');
    if (!section?.id) continue;
    if (isAnswered(answers, element.id)) continue;
    counts.set(section.id, (counts.get(section.id) ?? 0) + 1);
  }

  return counts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Driving the document
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select or deselect one option, exactly as clicking it in the document would.
 *
 * Single-choice inputs are radios, and checking a radio silently unchecks its
 * sibling without firing `change` on it — which is why `doc-choice` re-reads
 * every input in the group rather than trusting a payload, and why this only
 * has to touch the one input the reader acted on.
 */
export function selectOption(docPage: Element, id: string, value: string, on: boolean): void {
  const input = optionInput(docPage, id, value);
  if (!input) return;

  input.checked = input.type === 'radio' ? true : on;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** True when the document currently has `value` selected for `id`. */
export function isSelected(answers: AnswerMap, id: string, value: string): boolean {
  return answers[id]?.keys.includes(value) ?? false;
}

/** Write the Other free-text field. */
export function setOtherText(docPage: Element, id: string, text: string): void {
  writeTextarea(fieldOf(docPage, id, 'other-text'), text);
}

/** Write the note field, opening it first so the document shows what was typed. */
export function setNote(docPage: Element, id: string, text: string): void {
  const choice = questionElement(docPage, id);
  const toggle = choice?.querySelector<HTMLElement>(':scope > [data-part="note-toggle"]');
  if (toggle?.getAttribute('aria-expanded') === 'false' && text !== '') toggle.click();

  writeTextarea(fieldOf(docPage, id, 'note'), text);
}

/** Pick a score on a `doc-rating`, by pressing the button the reader would. */
export function setRating(docPage: Element, id: string, score: number): void {
  questionElement(docPage, id)
    ?.querySelector<HTMLButtonElement>(`[data-part="score-btn"][data-score="${score}"]`)
    ?.click();
}

/**
 * Put a question back to unanswered.
 *
 * Every control is cleared through the element rather than by deleting the
 * store entry, so a `doc-choice` whose radio is still visually checked cannot
 * survive the reset — the DOM and the store are reset by the same pass.
 */
export function clearAnswer(docPage: Element, id: string): void {
  const choice = questionElement(docPage, id);
  if (!choice) return;

  const inputs = Array.from(
    choice.querySelectorAll<HTMLInputElement>('[data-part="control"] input'),
  );
  for (const input of inputs) input.checked = false;

  writeTextarea(fieldOf(docPage, id, 'other-text'), '');
  writeTextarea(fieldOf(docPage, id, 'note'), '');

  // One change event is enough: the group is re-read in full on every change.
  inputs[0]?.dispatchEvent(new Event('change', { bubbles: true }));

  // A rating has no inputs to clear, so its store entry is the only state.
  for (const button of Array.from(
    choice.querySelectorAll<HTMLElement>('[data-part="score-btn"][data-selected="true"]'),
  )) {
    button.dataset.selected = 'false';
    button.setAttribute('aria-checked', 'false');
  }
}

/** Scroll the document to a question and leave it focused for the keyboard. */
export function revealQuestion(docPage: Element, id: string): void {
  const element = questionElement(docPage, id);
  if (!element) return;

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function questionElement(docPage: Element, id: string): HTMLElement | null {
  if (!id) return null;
  return docPage.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
}

function optionInput(docPage: Element, id: string, value: string): HTMLInputElement | null {
  const choice = questionElement(docPage, id);
  if (!choice) return null;

  return (
    Array.from(choice.querySelectorAll<HTMLInputElement>('[data-part="control"] input')).find(
      (input) => input.value === value,
    ) ?? null
  );
}

function fieldOf(docPage: Element, id: string, part: string): HTMLTextAreaElement | null {
  const choice = questionElement(docPage, id);
  return choice?.querySelector<HTMLTextAreaElement>(`[data-part="${part}"]`) ?? null;
}

/** Set a value and tell the element, the way typing into it would. */
function writeTextarea(field: HTMLTextAreaElement | null, text: string): void {
  if (!field) return;
  if (field.value === text) return;

  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
