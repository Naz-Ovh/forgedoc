/**
 * Acceptance 12: `skills/better-plan/CHEATSHEET.md` fits on one printed page.
 *
 * why this is a test and not a review note (§8): the cheatsheet is the authoring
 * agent's primary reference, and the one-page limit is the forcing function that
 * keeps the vocabulary from growing. "If it does not fit, the vocabulary has
 * grown too far and something must merge."
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TAG_NAMES, TAGS, type TagSpec } from '../../src/core/contract.js';

const CHEATSHEET = readFileSync(
  fileURLToPath(new URL('../../skills/better-plan/CHEATSHEET.md', import.meta.url)),
  'utf8',
);

/*
 * A4 at 10pt in a rendered markdown page holds roughly 70 visual lines. Markdown
 * table rows wrap, so the budget is expressed in both lines and characters and
 * the tighter of the two applies.
 */
const MAX_LINES = 78;
const MAX_CHARACTERS = 4800;

/**
 * Length as rendered, not as stored.
 *
 * why normalise first: the markdown tables are padded so the pipes line up in
 * the source, which adds roughly 2,300 characters of pure whitespace here.
 * None of it reaches the page, so counting it would fail the budget for a
 * formatting choice rather than for content.
 */
function renderedLength(markdown: string): number {
  return markdown
    .replace(/[ \t]+/g, ' ')
    .replace(/ \|/g, '|')
    .replace(/\| /g, '|').length;
}

describe('CHEATSHEET.md', () => {
  it('fits on one printed page', () => {
    const lines = CHEATSHEET.trimEnd().split('\n').length;
    const characters = renderedLength(CHEATSHEET);

    expect(lines, `${lines} lines; budget is ${MAX_LINES}`).toBeLessThanOrEqual(MAX_LINES);
    expect(
      characters,
      `${characters} rendered characters; budget is ${MAX_CHARACTERS}`,
    ).toBeLessThanOrEqual(MAX_CHARACTERS);
  });

  it('documents every tag the agent may write', () => {
    const authored = TAG_NAMES.filter((name) => !(TAGS[name] as TagSpec).generated);
    const missing = authored.filter((name) => !CHEATSHEET.includes(name));

    expect(missing, `Not on the cheatsheet: ${missing.join(', ')}`).toEqual([]);
  });

  it('names the generated tag only as something never to write', () => {
    expect(CHEATSHEET).toContain('Never write `plan-toc`');
  });

  it('lists the three override tiers in the documented order', () => {
    const preset = CHEATSHEET.indexOf('Preset attribute');
    const token = CHEATSHEET.indexOf('**Token**');
    const raw = CHEATSHEET.indexOf('**Raw CSS**');

    expect(preset).toBeGreaterThan(0);
    expect(token).toBeGreaterThan(preset);
    expect(raw).toBeGreaterThan(token);
  });
});
