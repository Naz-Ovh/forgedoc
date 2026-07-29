/**
 * `<plan-caption>` — a rich caption for a `plan-figure`.
 *
 * The alternative to the `caption` attribute, for captions that need a link or
 * inline code. `plan-figure` names it as its caption part; this element only
 * carries the semantics.
 */

import { PlanElement } from '../core/base.js';

export class PlanCaption extends PlanElement {
  protected enhance(): void {
    this.internals.role = 'caption';
  }
}
