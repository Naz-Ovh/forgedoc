/**
 * `<doc-why>` — why a roadblock happens. Optional inside `doc-blocker`.
 */

import { DocElement } from '../core/base.js';
import { labelRoadblockPart } from './doc-action.js';

export class DocWhy extends DocElement {
  protected enhance(): void {
    labelRoadblockPart(this, 'Why');
  }
}
