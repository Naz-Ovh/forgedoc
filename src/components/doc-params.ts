/**
 * `<doc-params>` — container for API or function parameters, flags, or fields.
 */

import { DocElement } from '../core/base.js';

export class DocParams extends DocElement {
  protected enhance(): void {
    this.internals.role = 'list';
    this.internals.ariaLabel = 'Parameters';
  }
}
