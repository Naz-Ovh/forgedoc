/**
 * `doc-carousel` — one slide selected at a time, and the controls that change it.
 *
 * Which slide is *shown* is a styling question and is not asserted here. What
 * these check is the state the component owns: the `hidden` attribute it sets,
 * and the active dot it marks.
 */

import { expect, test } from 'vitest';

import { mountPlan } from '../helpers.js';

const THREE_SLIDES = `
  <doc-section title="Mockups">
    <doc-carousel title="Product mockups">
      <doc-figure type="svg"><svg viewBox="0 0 10 10" role="img" aria-label="One"></svg></doc-figure>
      <doc-figure type="svg"><svg viewBox="0 0 10 10" role="img" aria-label="Two"></svg></doc-figure>
      <doc-figure type="svg"><svg viewBox="0 0 10 10" role="img" aria-label="Three"></svg></doc-figure>
    </doc-carousel>
  </doc-section>`;

/** The author's slides, in order. */
function slidesOf(carousel: Element): HTMLElement[] {
  return Array.from(carousel.querySelectorAll<HTMLElement>(':scope > doc-figure'));
}

/** Index of every slide the component has left unhidden. */
function visibleIndexes(carousel: Element): number[] {
  return slidesOf(carousel)
    .map((slide, index) => (slide.hidden ? -1 : index))
    .filter((index) => index !== -1);
}

function carouselIn(docPage: Element): HTMLElement {
  return docPage.querySelector('doc-carousel') as HTMLElement;
}

/** The nth element carrying `part`. Throws rather than silently doing nothing. */
function partAt(carousel: Element, part: string, nth = 0): HTMLElement {
  const found = carousel.querySelectorAll<HTMLElement>(`[data-part="${part}"]`)[nth];
  if (!found) throw new Error(`no [data-part="${part}"] at index ${nth}`);
  return found;
}

function click(carousel: Element, part: string, nth = 0): void {
  partAt(carousel, part, nth).click();
}

test('shows exactly one slide on mount', () => {
  const carousel = carouselIn(mountPlan(THREE_SLIDES));

  expect(slidesOf(carousel)).toHaveLength(3);
  expect(visibleIndexes(carousel)).toEqual([0]);
});

test('builds one dot per slide, with the first marked active', () => {
  const carousel = carouselIn(mountPlan(THREE_SLIDES));

  expect(carousel.querySelectorAll('[data-part="dot"]')).toHaveLength(3);
  expect(partAt(carousel, 'dot', 0).dataset.active).toBe('true');
});

test('next advances one slide and only one stays visible', () => {
  const carousel = carouselIn(mountPlan(THREE_SLIDES));

  click(carousel, 'next-btn');
  expect(visibleIndexes(carousel)).toEqual([1]);

  click(carousel, 'next-btn');
  expect(visibleIndexes(carousel)).toEqual([2]);
});

test('prev and next wrap around the ends', () => {
  const carousel = carouselIn(mountPlan(THREE_SLIDES));

  // Backwards off the front lands on the last slide.
  click(carousel, 'prev-btn');
  expect(visibleIndexes(carousel)).toEqual([2]);

  // Forwards off the end returns to the first.
  click(carousel, 'next-btn');
  expect(visibleIndexes(carousel)).toEqual([0]);
});

test('a dot jumps straight to its slide and moves the active marker', () => {
  const carousel = carouselIn(mountPlan(THREE_SLIDES));

  click(carousel, 'dot', 2);

  expect(visibleIndexes(carousel)).toEqual([2]);
  expect(partAt(carousel, 'dot', 2).dataset.active).toBe('true');
  expect(partAt(carousel, 'dot', 0).dataset.active).toBe('false');
});

test('a single slide gets no controls and stays visible', () => {
  const docPage = mountPlan(`
    <doc-section title="One">
      <doc-carousel title="Only one">
        <doc-figure type="svg"><svg viewBox="0 0 10 10" role="img" aria-label="Solo"></svg></doc-figure>
      </doc-carousel>
    </doc-section>`);
  const carousel = carouselIn(docPage);

  expect(carousel.querySelector('[data-part="controls"]')).toBeNull();
  expect(visibleIndexes(carousel)).toEqual([0]);
});
