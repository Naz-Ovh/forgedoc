/**
 * `<doc-rating question="Confidence level" scale="5">`
 *
 * Interactive rating question (e.g. 1-5 confidence, complexity score).
 * Parts: `question`, `scale`, `score-btn`.
 */

import { DocElement } from '../core/base.js';
import { createPart } from '../core/parts.js';
import { questionId } from '../core/slug.js';
import type { StoredAnswer } from '../core/types.js';

export class DocRating extends DocElement {
  #buttons: HTMLButtonElement[] = [];

  protected enhance(): void {
    if (!this.id) this.id = questionId(this.attr('question'));

    this.internals.role = 'radiogroup';
    this.internals.ariaLabel = this.attr('question');

    const question = this.attr('question');
    const scale = Math.max(3, Math.min(10, Number.parseInt(this.attr('scale', '5'), 10) || 5));

    const qEl = createPart('question', 'div', { text: question });
    this.prepend(qEl);

    const scaleContainer = createPart('scale', 'div');

    for (let i = 1; i <= scale; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(i);
      btn.dataset.part = 'score-btn';
      btn.dataset.score = String(i);
      btn.setAttribute('aria-label', `Rating ${i} of ${scale}`);

      this.on(btn, 'click', () => {
        this.#selectScore(i);
      });

      this.#buttons.push(btn);
      scaleContainer.append(btn);
    }

    qEl.after(scaleContainer);

    // Restore saved score if available
    const store = this.store();
    if (store && this.id) {
      const saved = store.get('answers')[this.id];
      if (saved?.keys?.[0]) {
        const num = Number.parseInt(saved.keys[0], 10);
        if (num >= 1 && num <= scale) {
          this.#applySelection(num);
        }
      }
    }
  }

  #selectScore(score: number): void {
    this.#applySelection(score);

    const store = this.store();
    if (store && this.id) {
      const answer: StoredAnswer = {
        keys: [String(score)],
      };
      store.set('answers', { ...store.get('answers'), [this.id]: answer });
    }
  }

  #applySelection(score: number): void {
    this.#buttons.forEach((btn, index) => {
      const val = index + 1;
      const isSelected = val === score;
      btn.setAttribute('aria-checked', String(isSelected));
      btn.dataset.selected = isSelected ? 'true' : 'false';
    });
  }
}
