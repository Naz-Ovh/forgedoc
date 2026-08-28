/**
 * `<doc-timeline>` — date-anchored timeline for delivery milestones.
 */

import { DocElement } from '../core/base.js';

export class DocTimeline extends DocElement {
  protected enhance(): void {
    this.internals.role = 'list';
    this.internals.ariaLabel = 'Timeline Milestones';
  }
}
