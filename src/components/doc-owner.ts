/**
 * `<doc-owner name="Alice" role="DRI" status="approved">`
 *
 * One owner, author or reviewer.
 * Parts: `avatar`, `details`, `name`, `role`, `status`.
 */

import { DocElement } from '../core/base.js';
import { createPart } from '../core/parts.js';

export class DocOwner extends DocElement {
  protected enhance(): void {
    this.internals.role = 'listitem';

    const name = this.attr('name');
    const role = this.attr('role', 'Owner');
    const status = this.attr('status', 'reviewing');
    const avatar = this.attr('avatar');

    const avatarEl = createPart('avatar', 'span', {
      text: avatar || name.charAt(0).toUpperCase() || '?',
    });
    this.append(avatarEl);

    const details = createPart('details', 'div');
    const nameEl = createPart('name', 'span', { text: name });
    const roleEl = createPart('role', 'span', { text: role });
    details.append(nameEl, roleEl);
    this.append(details);

    const statusEl = createPart('status', 'span', { text: status });
    statusEl.dataset.status = status;
    this.append(statusEl);
  }
}
