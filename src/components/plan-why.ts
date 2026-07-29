/**
 * `<plan-why>` — why a roadblock happens. Optional inside `plan-blocker`.
 */

import { PlanElement } from '../core/base.js';
import { labelRoadblockPart } from './plan-action.js';

export class PlanWhy extends PlanElement {
  protected enhance(): void {
    labelRoadblockPart(this, 'Why');
  }
}
