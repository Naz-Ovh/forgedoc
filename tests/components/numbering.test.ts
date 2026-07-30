/**
 * §13.2: nested sections produce `1.2.1`, letter keys skip correctly, and stage
 * numbers start at 0.
 */

import { describe, expect, it } from 'vitest';

import { letterKey, OTHER_KEY, optionKeys, stageNumbers } from '../../src/core/numbering.js';
import { mountPlan } from '../helpers.js';

const OUTLINE = `
  <doc-section title="One"><p>a</p>
    <doc-section title="One A"><p>b</p></doc-section>
    <doc-section title="One B"><p>c</p>
      <doc-section title="One B i"><p>d</p></doc-section>
    </doc-section>
  </doc-section>
  <doc-section title="Two"><p>e</p>
    <doc-section title="Two A"><p>f</p></doc-section>
  </doc-section>
`;

describe('section numbering', () => {
  it('numbers a nested outline', () => {
    const docPage = mountPlan(OUTLINE);
    const numbers = Array.from(docPage.querySelectorAll('doc-section')).map(
      (section) => (section as HTMLElement).dataset.number,
    );

    expect(numbers).toEqual(['1', '1.1', '1.2', '1.2.1', '2', '2.1']);
  });

  it('records depth so the CSS counters can key off it', () => {
    const docPage = mountPlan(OUTLINE);
    const depths = Array.from(docPage.querySelectorAll('doc-section')).map(
      (section) => (section as HTMLElement).dataset.depth,
    );

    expect(depths).toEqual(['1', '2', '2', '3', '1', '2']);
  });

  it('derives ids from titles', () => {
    const docPage = mountPlan(OUTLINE);
    const ids = Array.from(docPage.querySelectorAll('doc-section')).map((section) => section.id);

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
    const firstNumber = counted.querySelector('doc-section [data-part="number"]') as HTMLElement;
    expect(firstNumber.textContent).toBe('');
    expect(firstNumber.dataset.numberingMode).toBeUndefined();
    counted.remove();

    const written = mountPlan(OUTLINE, 'doc-id="text-numbers" numbering="text"');
    const textNumbers = Array.from(
      written.querySelectorAll('doc-section [data-part="number"]'),
    ).map((element) => element.textContent);
    expect(textNumbers).toEqual(['1', '1.1', '1.2', '1.2.1', '2', '2.1']);
  });

  it('gives the number a heading level that matches the depth', () => {
    const docPage = mountPlan(OUTLINE);
    const tags = Array.from(docPage.querySelectorAll('doc-section > [data-part="heading"]')).map(
      (heading) => heading.tagName.toLowerCase(),
    );

    expect(tags).toEqual(['h2', 'h3', 'h3', 'h4', 'h2', 'h3']);
  });

  it('builds a TOC entry per section, in document order', () => {
    const docPage = mountPlan(OUTLINE);
    const entries = Array.from(docPage.querySelectorAll('doc-toc [data-part="entry"]'));

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
    const docPage = mountPlan(`
      <doc-choice mode="single" question="Which one?">
        <doc-option>First</doc-option>
        <doc-option>Second</doc-option>
        <doc-option>Third</doc-option>
      </doc-choice>
    `);

    const keys = Array.from(docPage.querySelectorAll('doc-option')).map(
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
    const docPage = mountPlan(`
      <doc-roadmap>
        <doc-stage title="Alpha"><p>a</p></doc-stage>
        <doc-stage title="Beta"><p>b</p></doc-stage>
        <doc-stage title="Gamma"><p>c</p></doc-stage>
      </doc-roadmap>
    `);

    const badges = Array.from(docPage.querySelectorAll('doc-stage [data-part="badge"]')).map(
      (badge) => badge.textContent,
    );
    expect(badges).toEqual(['0', '1', '2']);
  });
});

describe('doc-ref', () => {
  it('resolves to the live number', () => {
    const docPage = mountPlan(`
      ${OUTLINE}
      <doc-section title="Cross references">
        <p><doc-ref to="sec-one-b-i"></doc-ref> and <doc-ref to="sec-two"></doc-ref>.</p>
      </doc-section>
    `);

    const refs = Array.from(docPage.querySelectorAll('doc-ref')).map((ref) => ref.textContent);
    expect(refs).toEqual(['Section 1.2.1', 'Section 2']);
  });

  it('resolves a stage and a question by their derived ids', () => {
    const docPage = mountPlan(`
      <doc-roadmap><doc-stage title="Alpha"><p>a</p></doc-stage><doc-stage title="Beta"><p>b</p></doc-stage></doc-roadmap>
      <doc-choice mode="single" question="Ready?"><doc-option>Yes</doc-option><doc-option>No</doc-option></doc-choice>
      <p><doc-ref to="stage-beta"></doc-ref> · <doc-ref to="q-ready"></doc-ref></p>
    `);

    const refs = Array.from(docPage.querySelectorAll('doc-ref')).map((ref) => ref.textContent);
    expect(refs).toEqual(['Stage 1', 'Question 1']);
  });
});
