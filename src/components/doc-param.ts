/**
 * `<doc-param name="timeout" type="number" required default="3000">`
 *
 * One parameter specification.
 * Parts: `header`, `name`, `type`, `badge`, `default`, `body`.
 */

import { DocElement } from '../core/base.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

export class DocParam extends DocElement {
  protected enhance(): void {
    this.internals.role = 'listitem';

    const name = this.attr('name');
    const type = this.attr('type');
    const isRequired = this.flag('required');
    const defaultValue = this.attr('default');

    nameAuthorContent(this, 'body');

    const header = createPart('header', 'div');

    const nameEl = createPart('name', 'code', { text: name });
    header.append(nameEl);

    if (type) {
      const typeEl = createPart('type', 'span', { text: type });
      header.append(typeEl);
    }

    const badgeEl = createPart('badge', 'span', {
      text: isRequired ? 'required' : 'optional',
    });
    badgeEl.dataset.kind = isRequired ? 'required' : 'optional';
    header.append(badgeEl);

    if (defaultValue) {
      const defaultEl = createPart('default', 'span', { text: `default: ${defaultValue}` });
      header.append(defaultEl);
    }

    this.prepend(header);
  }
}
