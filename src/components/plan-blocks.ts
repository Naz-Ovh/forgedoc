/**
 * `<plan-blocks>` — what a roadblock breaks. Required inside `plan-blocker`.
 *
 * The three roadblock children share one shape: a generated label followed by
 * the author's text, styled as a definition row.
 */

import { PlanElement } from '../core/base.js';
import { labelRoadblockPart } from './plan-action.js';

export class PlanBlocks extends PlanElement {
  protected enhance(): void {
    labelRoadblockPart(this, 'Blocks');
  }
}
