/**
 * `<doc-stats>` — container grid for KPI and metric cards.
 */

import { DocElement } from '../core/base.js';

export class DocStats extends DocElement {
  protected enhance(): void {
    this.internals.role = 'region';
    this.internals.ariaLabel = 'Metrics and Key Results';
  }
}
