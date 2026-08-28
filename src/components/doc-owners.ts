/**
 * `<doc-owners>` — container for document owners, DRIs, and approvers.
 */

import { DocElement } from '../core/base.js';

export class DocOwners extends DocElement {
  protected enhance(): void {
    this.internals.role = 'list';
    this.internals.ariaLabel = 'Owners and Approvers';
  }
}
