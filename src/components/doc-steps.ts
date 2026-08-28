/**
 * `<doc-steps>` — vertical step-by-step walkthrough container.
 */

import { DocElement } from '../core/base.js';

export class DocSteps extends DocElement {
  protected enhance(): void {
    this.internals.role = 'list';
    this.internals.ariaLabel = 'Steps';
  }
}
