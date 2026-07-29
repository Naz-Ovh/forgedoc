/**
 * §13.2: nested sections produce `1.2.1`, letter keys skip correctly, and stage
 * numbers start at 0.
 */

import { describe, expect, it } from 'vitest';

import { letterKey, OTHER_KEY, optionKeys, stageNumbers } from '../../src/core/numbering.js';
import { mountPlan } from '../helpers.js';

const OUTLINE = `
  <plan-section title="One"><p>a</p>
    <plan-section title="One A"><p>b</p></plan-section>
    <plan-section title="One B"><p>c</p>
      <plan-section title="One B i"><p>d</p></plan-section>
    </plan-section>
  </plan-section>
  <plan-section title="Two"><p>e</p>
    <plan-section title="Two A"><p>f</p></plan-section>
  </plan-section>
`;

describe('section numbering', () => {
  it('numbers a nested outline', () => {
    const planDoc = mountPlan(OUTLINE);
    const numbers = Array.from(planDoc.querySelectorAll('plan-section')).map(
      (section) => (section as HTMLElement).dataset.number,
    );

    expect(numbers).toEqual(['1', '1.1', '1.2', '1.2.1', '2', '2.1']);
  });

  it('records depth so the CSS counters can key off it', () => {
    const planDoc = mountPlan(OUTLINE);
    const depths = Array.from(planDoc.querySelectorAll('plan-section')).map(
      (section) => (section as HTMLElement).dataset.depth,
    );

    expect(depths).toEqual(['1', '2', '2', '3', '1', '2']);
  });

  it('derives ids from titles', () => {
    const planDoc = mountPlan(OUTLINE);
    const ids = Array.from(planDoc.querySelectorAll('plan-section')).map((section) => section.id);

    expect(ids).toEqual([
      'sec-one',
      'sec-one-a',
      'sec-one-b',
      'sec-one-b-i',
      'sec-two',
      'sec-two-a',
    ]);
  });

  it('renders the number as a CSS counter by default, and as text on request', () => {
    const counted = mountPlan(OUTLINE);
    const firstNumber = counted.querySelector('plan-section [data-part="number"]') as HTMLElement;
    expect(firstNumber.textContent).toBe('');
    expect(firstNumber.dataset.numberingMode).toBeUndefined();
    counted.remove();

    const written = mountPlan(OUTLINE, 'plan-id="text-numbers" numbering="text"');
    const textNumbers = Array.from(
      written.querySelectorAll('plan-section [data-part="number"]'),
    ).map((element) => element.textContent);
    expect(textNumbers).toEqual(['1', '1.1', '1.2', '1.2.1', '2', '2.1']);
  });

  it('gives the number a heading level that matches the depth', () => {
    const planDoc = mountPlan(OUTLINE);
    const tags = Array.from(planDoc.querySelectorAll('plan-section > [data-part="heading"]')).map(
      (heading) => heading.tagName.toLowerCase(),
    );

    expect(tags).toEqual(['h2', 'h3', 'h3', 'h4', 'h2', 'h3']);
  });

  it('builds a TOC entry per section, in document order', () => {
    const planDoc = mountPlan(OUTLINE);
    const entries = Array.from(planDoc.querySelectorAll('plan-toc [data-part="entry"]'));

    expect(entries).toHaveLength(6);
    expect(entries[3]?.getAttribute('href')).toBe('#sec-one-b-i');
    expect(entries[3]?.querySelector('[data-part="entry-number"]')?.textContent).toBe('1.2.1');
  });
});

describe('letter keys', () => {
  it('counts A, B, C… and rolls over past Z', () => {
    expect(letterKey(0)).toBe('A');
    expect(letterKey(25)).toBe('Z');
    expect(letterKey(26)).toBe('AA');
    expect(letterKey(27)).toBe('AB');
  });

  /* `O` is reserved for the always-appended Other option (§8.4). */
  it('skips the key reserved for Other', () => {
    expect(optionKeys(16)).not.toContain(OTHER_KEY);
    expect(optionKeys(16)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
      'I',
      'J',
      'K',
      'L',
      'M',
      'N',
      'P',
      'Q',
    ]);
  });

  it('assigns them in document order, and Other last', () => {
    const planDoc = mountPlan(`
      <plan-choice mode="single" question="Which one?">
        <plan-option>First</plan-option>
        <plan-option>Second</plan-option>
        <plan-option>Third</plan-option>
      </plan-choice>
    `);

    const keys = Array.from(planDoc.querySelectorAll('plan-option')).map(
      (option) => (option as HTMLElement).dataset.key,
    );
    expect(keys).toEqual(['A', 'B', 'C', 'O']);
  });
});

describe('stage numbering', () => {
  /* MUST (§8.5): starts at 0, matching the reference where Stage 0 is next. */
  it('starts at zero by default', () => {
    expect(stageNumbers(3)).toEqual([0, 1, 2]);
  });

  it('honours an explicit start', () => {
    expect(stageNumbers(3, 5)).toEqual([5, 6, 7]);
  });

  it('numbers the badges in the DOM', () => {
    const planDoc = mountPlan(`
      <plan-roadmap>
        <plan-stage title="Alpha"><p>a</p></plan-stage>
        <plan-stage title="Beta"><p>b</p></plan-stage>
        <plan-stage title="Gamma"><p>c</p></plan-stage>
      </plan-roadmap>
    `);

    const badges = Array.from(planDoc.querySelectorAll('plan-stage [data-part="badge"]')).map(
      (badge) => badge.textContent,
    );
    expect(badges).toEqual(['0', '1', '2']);
  });
});

describe('plan-ref', () => {
  it('resolves to the live number', () => {
    const planDoc = mountPlan(`
      ${OUTLINE}
      <plan-section title="Cross references">
        <p><plan-ref to="sec-one-b-i"></plan-ref> and <plan-ref to="sec-two"></plan-ref>.</p>
      </plan-section>
    `);

    const refs = Array.from(planDoc.querySelectorAll('plan-ref')).map((ref) => ref.textContent);
    expect(refs).toEqual(['Section 1.2.1', 'Section 2']);
  });

  it('resolves a stage and a question by their derived ids', () => {
    const planDoc = mountPlan(`
      <plan-roadmap><plan-stage title="Alpha"><p>a</p></plan-stage><plan-stage title="Beta"><p>b</p></plan-stage></plan-roadmap>
      <plan-choice mode="single" question="Ready?"><plan-option>Yes</plan-option><plan-option>No</plan-option></plan-choice>
      <p><plan-ref to="stage-beta"></plan-ref> · <plan-ref to="q-ready"></plan-ref></p>
    `);

    const refs = Array.from(planDoc.querySelectorAll('plan-ref')).map((ref) => ref.textContent);
    expect(refs).toEqual(['Stage 1', 'Question 1']);
  });
});
