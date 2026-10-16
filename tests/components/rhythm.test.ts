/**
 * The structural contract the edge-spacing rules rely on (`styles/base/_rhythm.scss`).
 *
 * A card's last author block is followed by nothing but its comment button.
 * The stylesheets select that block with
 * `:nth-last-child(1 of :not([data-part="feedback"]))`; `:last-child` silently
 * missed it once the button was appended, which is how stage and disclosure
 * bodies lost their bottom inset. This pins the DOM shape, not the look.
 */

import { expect, test } from 'vitest';

import { mountPlan } from '../helpers.js';

const LAST_CONTENT = ':nth-last-child(1 of :not([data-part="feedback"]))';

const MARKUP = `
  <doc-section title="Cards">
    <doc-roadmap start="1">
      <doc-stage title="One" current><p>Body.</p></doc-stage>
    </doc-roadmap>
    <doc-collapse title="More" open><p>Detail.</p></doc-collapse>
    <doc-blocker title="Stuck">
      <doc-blocks>Release.</doc-blocks>
      <doc-action>Ask.</doc-action>
    </doc-blocker>
  </doc-section>`;

test('a stage and a disclosure body are the last content child, before the comment button', () => {
  const docPage = mountPlan(MARKUP);

  for (const host of ['doc-stage', 'doc-collapse']) {
    const element = docPage.querySelector(host) as HTMLElement;
    const body = element.querySelector(':scope > [data-part="body"]') as HTMLElement;

    expect(element.lastElementChild?.getAttribute('data-part')).toBe('feedback');
    expect(body.matches(':last-child')).toBe(false);
    expect(body.matches(LAST_CONTENT)).toBe(true);
  }
});

test("a blocker's last row is its last content child", () => {
  const docPage = mountPlan(MARKUP);
  const action = docPage.querySelector('doc-blocker > doc-action') as HTMLElement;
  expect(action.matches(LAST_CONTENT)).toBe(true);
});

test('roadmap stages count from start', () => {
  const docPage = mountPlan(MARKUP);
  expect(docPage.querySelector('doc-stage [data-part="badge"]')?.textContent).toBe('1');
});
