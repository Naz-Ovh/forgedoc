/**
 * The view model behind the bucket's detail window.
 *
 * why a plain module rather than logic inside the Svelte component: this is the
 * part worth testing — reading the document back, deciding what an item is
 * anchored to, and pairing it against what the reader said. The component is
 * then only markup.
 *
 * The window exists because clicking a collected item used to scroll the page to
 * it, which loses the panel, loses the reader's place, and answers the wrong
 * question. What a reader checking their feedback wants is *both* sides at once:
 * what the document says, and what they said about it.
 */

import { optionLabel, optionValue } from '../components/plan-option.js';
import type { FeedbackItem, PlanState } from '../core/types.js';
import { type AnchoredContext, blockText, contextAround, isBlockItem } from './selection.js';
import type { BucketAnswer } from './serialize.js';

/** One option as it appears in an answer's detail pane. */
export interface DetailOption {
  readonly label: string;
  readonly chosen: boolean;
}

export interface DetailView {
  readonly id: string;
  readonly kind: 'answer' | 'comment';
  /** Heading for the window — the question, or the block/quote commented on. */
  readonly title: string;
  /** Human-readable location, e.g. `3.1 Data model`. Empty when unknown. */
  readonly at: string;
  /** Id the "go to it" action scrolls to. */
  readonly anchorId: string;
  readonly orphaned: boolean;
  /** `text` shows the quote in context; `block` shows the block's content. */
  readonly scope: 'text' | 'block';
  /** The document side: the quote with its surroundings, for a text comment. */
  readonly context: AnchoredContext | null;
  /** The document side: the block's own text, for a block comment. */
  readonly blockContent: string;
  /** The document side: every option, for an answer. */
  readonly options: readonly DetailOption[];
  /** The reader's side: their comment, or the labels they chose. */
  readonly feedback: string;
  /** A note attached to an answer. Empty when there is none. */
  readonly note: string;
}

/** Detail for one answered question, read back from the live document. */
export function detailForAnswer(
  planDoc: Element,
  answer: BucketAnswer,
  state: PlanState,
): DetailView {
  return {
    id: answer.anchorId,
    kind: 'answer',
    title: answer.question,
    at: locationOf(planDoc, answer.anchorId),
    anchorId: answer.anchorId,
    // An answer's anchor is the question element; if that is gone the answer is
    // still perfectly readable, because the bucket carries the text verbatim.
    orphaned: false,
    scope: 'text',
    context: null,
    blockContent: '',
    options: optionsOf(planDoc, answer.anchorId, state),
    feedback: answer.labels.join('\n'),
    note: answer.note ?? '',
  };
}

/** Detail for one reader comment. */
export function detailForComment(
  planDoc: Element,
  item: FeedbackItem,
  orphaned: boolean,
): DetailView {
  const block = isBlockItem(item);

  return {
    id: item.id,
    kind: 'comment',
    title: block ? item.range.quote : `“${item.range.quote}”`,
    at: item.at,
    anchorId: item.range.anchorId,
    orphaned,
    scope: block ? 'block' : 'text',
    context: block ? null : contextAround(planDoc, item.range),
    blockContent: block ? blockText(planDoc, item.range.anchorId) : '',
    options: [],
    feedback: item.comment,
    note: '',
  };
}

/**
 * Every option of a question, marked with whether the reader chose it.
 *
 * why all of them rather than only the chosen ones: the panel already lists what
 * was chosen. What the detail window adds is what was *not* — the reader
 * reviewing their own answer wants to see the alternatives they passed over.
 */
function optionsOf(planDoc: Element, anchorId: string, state: PlanState): DetailOption[] {
  const choice = planDoc.querySelector(`#${CSS.escape(anchorId)}`);
  if (!choice) return [];

  const chosenKeys = state.answers[anchorId]?.keys ?? [];
  const options: DetailOption[] = [];

  for (const option of Array.from(choice.querySelectorAll<HTMLElement>(':scope > plan-option'))) {
    const key = option.dataset.key ?? '';
    const label =
      option.dataset.part === 'other'
        ? (state.answers[anchorId]?.otherText ?? 'Other — type your own solution')
        : optionLabel(option);

    options.push({ label, chosen: chosenKeys.includes(optionValue(option, key)) });
  }

  return options;
}

/** `3.1 Data model` for whatever section an anchor lives in. */
function locationOf(planDoc: Element, anchorId: string): string {
  const section = planDoc.querySelector(`#${CSS.escape(anchorId)}`)?.closest('plan-section');
  if (!section) return '';

  const number = section.getAttribute('data-number') ?? '';
  const title = section.getAttribute('title') ?? '';
  return `${number} ${title}`.trim();
}
