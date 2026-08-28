/**
 * `<doc-stat label="Target P99" value="< 45ms" trend="down" good diff="-12ms">`
 *
 * Metric / KPI card.
 * Parts: `label`, `value-row`, `value`, `diff`, `body`.
 */

import { DocElement } from '../core/base.js';
import { createPart, nameAuthorContent } from '../core/parts.js';

export class DocStat extends DocElement {
  protected enhance(): void {
    const label = this.attr('label');
    const value = this.attr('value');
    const trend = this.attr('trend');
    const isGood = this.flag('good');
    const diff = this.attr('diff');

    nameAuthorContent(this, 'body');

    const labelEl = createPart('label', 'div', { text: label });
    this.prepend(labelEl);

    const valueRow = createPart('value-row', 'div');
    const valueEl = createPart('value', 'div', { text: value });
    valueRow.append(valueEl);

    if (diff || trend) {
      const glyph = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
      const diffEl = createPart('diff', 'span', { text: `${glyph} ${diff || ''}`.trim() });
      if (isGood) diffEl.dataset.tone = 'good';
      else if (this.attr('tone')) diffEl.dataset.tone = this.attr('tone');
      valueRow.append(diffEl);
    }

    labelEl.after(valueRow);
  }
}
