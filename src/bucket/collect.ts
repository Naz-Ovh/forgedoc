/**
 * Gather the live document into a `BucketDocument`.
 *
 * why answers are read from the DOM rather than only from the store (§10.3):
 * the bucket has to be self-contained. It carries the question text and the
 * chosen option labels **verbatim**, so an agent reading a pasted bucket in a
 * fresh session needs no access to the original file — and the option *label* is
 * authoritative over the option key when the two disagree.
 */

import type { PlanChoice } from '../components/plan-choice.js';
import type { PlanState, PlanStore } from '../core/types.js';
import type { BucketAnswer, BucketComment, BucketDocument, BucketEntry } from './serialize.js';

/** ISO 8601 to seconds precision. Milliseconds add noise to a human-read file. */
export function timestampNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Everything the reader has said about this document, in document order. */
export function collectBucket(
  planDoc: Element,
  state: PlanState,
  timestamp: string = timestampNow(),
): BucketDocument {
  return {
    planId: state.planId,
    timestamp,
    entries: [...collectAnswers(planDoc, state), ...collectComments(state)],
  };
}

/** Answered questions, in document order. Exported so the panel can list them. */
export function collectAnswers(planDoc: Element, state: PlanState): BucketAnswer[] {
  const entries: BucketAnswer[] = [];

  for (const element of Array.from(planDoc.querySelectorAll('plan-choice'))) {
    const stored = state.answers[element.id];
    if (!stored) continue;
    if (stored.keys.length === 0 && !stored.note) continue;

    // Duck-typed rather than instanceof: the element may not have upgraded yet
    // when tooling calls this, and the store still holds a usable answer.
    const choice = element as unknown as PlanChoice;
    const labels =
      typeof choice.labelsForKeys === 'function' ? choice.labelsForKeys(stored.keys) : stored.keys;

    entries.push({
      kind: 'answer',
      anchorId: element.id,
      question: element.getAttribute('question') ?? '',
      labels: labels.length > 0 ? labels : ['(no option selected)'],
      ...(stored.note ? { note: stored.note } : {}),
    });
  }

  return entries;
}

/** Reader comments, in the order they were made. */
export function collectComments(state: PlanState): BucketComment[] {
  return state.feedback.map((item) => ({
    kind: 'comment' as const,
    anchorId: item.range.anchorId,
    quote: item.range.quote,
    comment: item.comment,
    ...(item.at ? { at: item.at } : {}),
  }));
}

/** Number of things the reader has contributed, for the trigger's count badge. */
export function bucketCount(planDoc: Element, state: PlanState): number {
  return collectAnswers(planDoc, state).length + state.feedback.length;
}

export type { BucketEntry };

/** Drop answers and feedback, leaving reading convenience state alone. */
export function clearBucket(store: PlanStore): void {
  store.set('answers', {});
  store.set('feedback', []);
}
