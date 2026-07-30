/**
 * Acceptance criterion 10: the validator catches every error in
 * `tests/fixtures/broken/*.html`, **with correct line numbers**.
 *
 * The line numbers are the point. An agent closing its own write → build → read
 * errors → fix loop needs to be told where, not just what.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type Diagnostic, formatJson, formatText, validateHtml } from '../../tools/validate.js';

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8');

const validateFixture = (name: string, expectBuilt = false) =>
  validateHtml(fixture(name), { file: name, expectBuilt });

const ruleIds = (diagnostics: readonly Diagnostic[]): string[] =>
  diagnostics.map((diagnostic) => diagnostic.ruleId);

/** Each broken fixture, the rule it must trigger, and where. */
const BROKEN_CASES = [
  { file: 'no-doc-page.html', ruleId: 'doc/missing', line: 1 },
  { file: 'missing-doc-id.html', ruleId: 'doc/missing-doc-id', line: 3 },
  { file: 'duplicate-doc-page.html', ruleId: 'doc/duplicate', line: 6 },
  { file: 'one-option.html', ruleId: 'choice/too-few-options', line: 5 },
  { file: 'blocker-without-action.html', ruleId: 'child/missing-required', line: 5 },
  { file: 'term-without-href.html', ruleId: 'attr/missing-required', line: 5 },
  { file: 'unresolvable-ref.html', ruleId: 'ref/unresolvable', line: 5 },
  { file: 'unknown-lang.html', ruleId: 'code/unknown-lang', line: 5 },
  { file: 'section-without-title.html', ruleId: 'attr/missing-required', line: 4 },
  { file: 'authored-toc.html', ruleId: 'toc/authored', line: 4 },
  { file: 'unknown-tag.html', ruleId: 'tag/unknown', line: 5 },
  { file: 'unknown-attribute.html', ruleId: 'attr/unknown', line: 5 },
  { file: 'duplicate-id.html', ruleId: 'id/duplicate', line: 5 },
  { file: 'misplaced-child.html', ruleId: 'child/misplaced', line: 5 },
] as const;

describe('validator — broken fixtures', () => {
  for (const testCase of BROKEN_CASES) {
    it(`${testCase.file} reports ${testCase.ruleId} at line ${testCase.line}`, () => {
      const result = validateFixture(`broken/${testCase.file}`);

      const match = result.diagnostics.find((diagnostic) => diagnostic.ruleId === testCase.ruleId);
      expect(
        match,
        `expected ${testCase.ruleId}, got ${ruleIds(result.diagnostics).join(', ')}`,
      ).toBeDefined();
      expect(match?.severity).toBe('error');
      expect(match?.line).toBe(testCase.line);
      expect(match?.column).toBeGreaterThan(0);
      expect(match?.fix.length).toBeGreaterThan(10);
      expect(result.ok).toBe(false);
    });
  }

  it('reports an unreplaced placeholder only when the file claims to be built', () => {
    const asSource = validateFixture('broken/unreplaced-placeholder.html');
    expect(ruleIds(asSource.diagnostics)).not.toContain('build/unreplaced-placeholder');

    const asBuilt = validateFixture('broken/unreplaced-placeholder.html', true);
    const found = asBuilt.diagnostics.filter(
      (diagnostic) => diagnostic.ruleId === 'build/unreplaced-placeholder',
    );
    expect(found).toHaveLength(2);
    expect(found[0]?.line).toBeGreaterThan(1);
  });

  it('reports an out-of-enum preset value as an error', () => {
    const result = validateFixture('broken/unknown-attribute.html');
    const invalid = result.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === 'attr/invalid-value',
    );
    expect(invalid?.message).toContain('mode="sometimes"');
    expect(invalid?.fix).toContain('single | multi');
  });

  it('suggests the nearest tag for a typo', () => {
    const result = validateFixture('broken/unknown-tag.html');
    const unknown = result.diagnostics.find((diagnostic) => diagnostic.ruleId === 'tag/unknown');
    expect(unknown?.fix).toContain('Did you mean');
  });
});

describe('validator — the kitchen sink', () => {
  it('passes with no errors', () => {
    const result = validateFixture('kitchen-sink.html');
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('validator — warnings', () => {
  const WITH_WARNINGS = `<doc-page doc-id="warned">
  <doc-section title="Same name"><p>One.</p></doc-section>
  <doc-section title="Same name"><p>Two.</p></doc-section>
  <doc-figure type="svg"><svg></svg></doc-figure>
  <doc-note kind="info" style="--doc-space-unit: 3px"><p>Inline style.</p></doc-note>
</doc-page>`;

  it('warns without failing the build', () => {
    const result = validateHtml(WITH_WARNINGS, { file: 'warnings.html' });

    expect(ruleIds(result.diagnostics)).toEqual(
      expect.arrayContaining([
        'section/duplicate-slug',
        'figure/missing-caption',
        'doc/no-choice',
        'attr/inline-style',
      ]),
    );
    expect(result.errorCount).toBe(0);
    expect(result.ok).toBe(true);
  });

  it('warns on a section nested deeper than three levels', () => {
    const tooDeep = `<doc-page doc-id="deep">
  <doc-section title="One"><doc-section title="Two"><doc-section title="Three">
    <doc-section title="Four"><p>Too deep.</p></doc-section>
  </doc-section></doc-section></doc-section>
  <doc-choice question="Q?"><doc-option>A</doc-option><doc-option>B</doc-option></doc-choice>
</doc-page>`;

    const result = validateHtml(tooDeep, { file: 'deep.html' });
    expect(ruleIds(result.diagnostics)).toContain('section/too-deep');
    expect(result.ok).toBe(true);
  });
});

describe('validator — output formats', () => {
  it('emits machine-parseable JSON for an agent harness', () => {
    const result = validateFixture('broken/one-option.html');
    const parsed = JSON.parse(formatJson(result)) as {
      ok: boolean;
      errorCount: number;
      diagnostics: Diagnostic[];
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.errorCount).toBeGreaterThan(0);
    expect(parsed.diagnostics[0]).toMatchObject({
      severity: 'error',
      ruleId: expect.any(String),
      message: expect.any(String),
      fix: expect.any(String),
      file: expect.any(String),
      line: expect.any(Number),
      column: expect.any(Number),
    });
  });

  it('emits a human report with file:line:column and a fix', () => {
    const text = formatText(validateFixture('broken/one-option.html'));
    expect(text).toMatch(/broken\/one-option\.html:\d+:\d+ {2}error {2}choice\/too-few-options/);
    expect(text).toContain('fix:');
  });

  it('says ok when there is nothing to report', () => {
    expect(formatText(validateHtml(fixture('kitchen-sink.html'), { file: 'k.html' }))).toBe(
      'k.html: ok',
    );
  });
});
