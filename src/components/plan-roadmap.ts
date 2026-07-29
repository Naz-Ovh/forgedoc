/**
 * `<plan-roadmap>` — a numbered sequence of collapsible stages.
 *
 * MUST (§8.5): stage numbering starts at 0 by default, matching the reference
 * where Stage 0 is the next deliverable. `start` changes the first number.
 */

import { PlanElement } from '../core/base.js';
import { stageNumbers } from '../core/numbering.js';
import { setupStage } from './plan-stage.js';

export class PlanRoadmap extends PlanElement {
  protected enhance(): void {
    this.internals.role = 'list';

    const stages = Array.from(this.querySelectorAll<HTMLElement>(':scope > plan-stage'));
    const numbers = stageNumbers(stages.length, this.#start());

    stages.forEach((stage, index) => {
      setupStage(stage, { number: numbers[index] ?? index, total: stages.length });
    });
  }

  #start(): number {
    const parsed = Number.parseInt(this.attr('start', '0'), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
