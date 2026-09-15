/**
 * `<doc-carousel>` — visual carousel/slider for slides, mockups, and diagrams.
 *
 * Parts: `controls`, `prev-btn`, `next-btn`, `dots`, `dot`.
 */

import { DocElement } from '../core/base.js';
import { arrowLeftIcon, arrowRightIcon } from '../core/icons.js';
import { authorChildren, createPart } from '../core/parts.js';

export class DocCarousel extends DocElement {
  #currentIndex = 0;
  #slides: HTMLElement[] = [];
  #dots: HTMLButtonElement[] = [];

  protected enhance(): void {
    this.internals.role = 'region';
    this.internals.ariaLabel = this.attr('title', 'Carousel');

    const slides = authorChildren(this);
    this.#slides = slides;

    if (slides.length <= 1) return;

    if (this.findPart('controls')) return;

    slides.forEach((slide, index) => {
      slide.toggleAttribute('hidden', index !== 0);
    });

    const controls = createPart('controls', 'div');

    const prevBtn = createPart('prev-btn', 'button') as HTMLButtonElement;
    prevBtn.type = 'button';
    prevBtn.append(arrowLeftIcon('prev-icon'));
    prevBtn.setAttribute('aria-label', 'Previous slide');
    this.on(prevBtn, 'click', () => this.#showSlide(this.#currentIndex - 1));

    const nextBtn = createPart('next-btn', 'button') as HTMLButtonElement;
    nextBtn.type = 'button';
    nextBtn.append(arrowRightIcon('next-icon'));
    nextBtn.setAttribute('aria-label', 'Next slide');
    this.on(nextBtn, 'click', () => this.#showSlide(this.#currentIndex + 1));

    const dots = createPart('dots', 'div');
    slides.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.dataset.part = 'dot';
      dot.dataset.docChrome = '';
      dot.setAttribute('aria-label', `Slide ${index + 1}`);
      if (index === 0) dot.dataset.active = 'true';

      this.on(dot, 'click', () => this.#showSlide(index));
      this.#dots.push(dot);
      dots.append(dot);
    });

    controls.append(prevBtn, dots, nextBtn);
    this.append(controls);
  }

  #showSlide(targetIndex: number): void {
    if (this.#slides.length === 0) return;

    const count = this.#slides.length;
    const newIndex = (targetIndex + count) % count;
    this.#currentIndex = newIndex;

    this.#slides.forEach((slide, index) => {
      slide.toggleAttribute('hidden', index !== newIndex);
    });

    this.#dots.forEach((dot, index) => {
      dot.dataset.active = index === newIndex ? 'true' : 'false';
    });
  }
}
