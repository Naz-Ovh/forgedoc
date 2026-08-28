/**
 * `<doc-matrix type="raci">`
 *
 * Matrix / grid wrapper for RACI, Risk assessment, or comparative matrices.
 */

import { DocElement } from '../core/base.js';

export class DocMatrix extends DocElement {
  protected enhance(): void {
    this.internals.role = 'region';
    this.internals.ariaLabel = `${this.attr('type', 'comparison').toUpperCase()} Matrix`;
  }
}
