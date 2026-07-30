/**
 * §13.2: slugs are stable across regeneration, and duplicates get suffixes.
 *
 * The stability property is the load-bearing one. `doc-ref` targets, feedback
 * anchors and the reader's browser history all key off these ids, so a slug that
 * shifts because a plan was regenerated silently breaks every one of them.
 */

import { describe, expect, it } from 'vitest';

import {
  type IdCandidate,
  questionId,
  resolveIds,
  sectionId,
  slugify,
  uniqueSlug,
} from '../../src/core/slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('What We Are Building')).toBe('what-we-are-building');
  });

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
  });

  it('drops apostrophes instead of hyphenating them', () => {
    expect(slugify("The reader's answer")).toBe('the-readers-answer');
  });

  it('collapses punctuation runs and trims the ends', () => {
    expect(slugify('  Step 1 — “design”, then build!  ')).toBe('step-1-design-then-build');
  });

  it('never returns an empty string', () => {
    expect(slugify('—')).toBe('untitled');
    expect(slugify('')).toBe('untitled');
  });

  it('truncates at a word boundary, deterministically', () => {
    const long = slugify(
      'When one team member reads a notification should it show as read for the whole vendor team',
    );

    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('-')).toBe(false);
    expect(
      slugify(
        'When one team member reads a notification should it show as read for the whole vendor team',
      ),
    ).toBe(long);
  });

  it('is stable across regeneration when the title is unchanged', () => {
    const title = 'How the store handles unavailable localStorage';
    expect(sectionId(title)).toBe(sectionId(title));
    expect(sectionId(title)).toBe('sec-how-the-store-handles-unavailable-localstorage');
  });

  it('changes when the title changes, which is what makes anchors meaningful', () => {
    expect(sectionId('Data model')).not.toBe(sectionId('Data model, revised'));
  });
});

describe('uniqueSlug', () => {
  it('appends -2, -3 for duplicates', () => {
    const taken = new Set<string>();
    expect(uniqueSlug('sec-same', taken)).toBe('sec-same');
    expect(uniqueSlug('sec-same', taken)).toBe('sec-same-2');
    expect(uniqueSlug('sec-same', taken)).toBe('sec-same-3');
  });
});

describe('resolveIds', () => {
  it('reserves explicit ids before deriving any, wherever they appear', () => {
    const candidates: IdCandidate[] = [
      { explicitId: null, derivedId: 'sec-overview' },
      { explicitId: 'sec-overview', derivedId: 'sec-something-else' },
    ];

    // The explicit id wins outright; the derived one steps aside even though it
    // came first in the document.
    expect(resolveIds(candidates)).toEqual(['sec-overview-2', 'sec-overview']);
  });

  it('produces one id per candidate, all distinct', () => {
    const candidates: IdCandidate[] = [
      { explicitId: null, derivedId: sectionId('Same title') },
      { explicitId: null, derivedId: sectionId('Same title') },
      { explicitId: null, derivedId: questionId('Same title') },
    ];

    const resolved = resolveIds(candidates);
    expect(resolved).toHaveLength(3);
    expect(new Set(resolved).size).toBe(3);
    expect(resolved).toEqual(['sec-same-title', 'sec-same-title-2', 'q-same-title']);
  });
});
