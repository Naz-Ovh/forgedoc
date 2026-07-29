/**
 * `<plan-action>` — the action that resolves a roadblock. Required.
 *
 * why this is its own tag rather than a paragraph: the source skill requires
 * that every roadblock states what resolves it, and making that a validated
 * structure is the point (§8.3). The validator errors on a `plan-blocker`
 * without one.
 */

import { PlanElement } from '../core/base.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

/**
 * Give one roadblock child its generated label and name its body.
 *
 * Shared by `plan-blocks`, `plan-why` and `plan-action` — three occurrences, so
 * extracting it is warranted (§12: abstract at the third occurrence, not before).
 */
export function labelRoadblockPart(element: HTMLElement, label: string): void {
  if (element.querySelector(':scope > [data-part="label"]')) return;

  nameAuthorContent(element, 'body');
  element.prepend(createPart('label', 'span', { text: label }));
}

export class PlanAction extends PlanElement {
  protected enhance(): void {
    labelRoadblockPart(this, 'Action');
  }
}
