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

describe('validator — walkthroughs and custom blocks', () => {
  const page = (body: string): string => `<doc-page doc-id="w">
${body}
  <doc-choice question="Q?"><doc-option>A</doc-option><doc-option>B</doc-option></doc-choice>
</doc-page>`;

  const WALKTHROUGH = `  <doc-walkthrough title="Login">
    <doc-actor name="vendor" label="Vendor panel"></doc-actor>
    <doc-actor name="admin" label="Admin route"></doc-actor>
    <doc-scene title="Wrong door" focus="vendor admin">
      <doc-move from="vendor" to="admin" token="ub_vendor_session" result="reject"></doc-move>
      <doc-change actor="admin" set="401" tone="bad"></doc-change>
      <p>Rejected.</p>
    </doc-scene>
  </doc-walkthrough>`;

  it('accepts a well-formed walkthrough with nothing to report', () => {
    const result = validateHtml(page(WALKTHROUGH), { file: 'w.html' });
    expect(result.diagnostics).toEqual([]);
  });

  it('reports a move to an actor that was never declared, on the line of the move', () => {
    const broken = WALKTHROUGH.replace('to="admin"', 'to="amdin"');
    const result = validateHtml(page(broken), { file: 'w.html' });
    const unknown = result.diagnostics.find((d) => d.ruleId === 'walkthrough/unknown-actor');

    expect(unknown?.severity).toBe('error');
    expect(unknown?.line).toBe(6);
    expect(unknown?.message).toContain('"amdin"');
    expect(unknown?.fix).toContain('vendor, admin');
    expect(result.ok).toBe(false);
  });

  it('checks change targets and focus lists too', () => {
    const broken = WALKTHROUGH.replace('actor="admin"', 'actor="ghost"').replace(
      'focus="vendor admin"',
      'focus="vendor nobody"',
    );
    const result = validateHtml(page(broken), { file: 'w.html' });
    const messages = result.diagnostics
      .filter((d) => d.ruleId === 'walkthrough/unknown-actor')
      .map((d) => d.message);

    expect(messages).toHaveLength(2);
    expect(messages.join(' ')).toContain('"ghost"');
    expect(messages.join(' ')).toContain('"nobody"');
  });

  it('rejects two actors with the same name', () => {
    const broken = WALKTHROUGH.replace('name="admin"', 'name="vendor"');
    const result = validateHtml(page(broken), { file: 'w.html' });
    expect(ruleIds(result.diagnostics)).toContain('walkthrough/duplicate-actor');
    expect(result.ok).toBe(false);
  });

  it('rejects a self-closed walkthrough tag, which the browser would nest', () => {
    const broken = WALKTHROUGH.replace(
      '<doc-actor name="admin" label="Admin route"></doc-actor>',
      '<doc-actor name="admin" label="Admin route"/>',
    );
    const result = validateHtml(page(broken), { file: 'w.html' });
    const selfClosing = result.diagnostics.find((d) => d.ruleId === 'tag/self-closing');

    expect(selfClosing?.severity).toBe('error');
    expect(selfClosing?.line).toBe(4);
    expect(selfClosing?.fix).toContain('</doc-actor>');
  });

  it('only warns for a self-closed older tag, so existing documents keep building', () => {
    const result = validateHtml(page('  <doc-owners><doc-owner name="A"/></doc-owners>'), {
      file: 'w.html',
    });
    const selfClosing = result.diagnostics.find((d) => d.ruleId === 'tag/self-closing');
    expect(selfClosing?.severity).toBe('warning');
    expect(result.ok).toBe(true);
  });

  it('warns about a plain script inside a custom block and a forgedoc one outside', () => {
    const body = `  <doc-custom title="c"><div></div><script>window.x = 1;</script></doc-custom>
  <script type="forgedoc">block.remove();</script>`;
    const result = validateHtml(page(body), { file: 'w.html' });

    expect(ruleIds(result.diagnostics)).toEqual(
      expect.arrayContaining(['custom/plain-script', 'custom/orphan-script']),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a custom block with its own style, classes and forgedoc script', () => {
    const body = `  <doc-custom title="c">
    <style>.jar { gap: 4px; }</style>
    <div class="jar"><b>one</b></div>
    <script type="forgedoc">block.querySelector('.jar').dataset.ready = 'yes';</script>
  </doc-custom>`;
    expect(validateHtml(page(body), { file: 'w.html' }).diagnostics).toEqual([]);
  });

  it('hints, without failing, at a very large Mermaid diagram', () => {
    const edges = Array.from({ length: 20 }, (_, index) => `    N${index} --> N${index + 1}`);
    const body = `  <doc-figure type="mermaid" caption="Big">
    flowchart LR
${edges.join('\n')}
  </doc-figure>`;
    const result = validateHtml(page(body), { file: 'w.html' });
    const hint = result.diagnostics.find((d) => d.ruleId === 'figure/large-mermaid');

    expect(hint?.severity).toBe('warning');
    expect(result.ok).toBe(true);
  });

  it('says nothing about a small Mermaid diagram', () => {
    const body = `  <doc-figure type="mermaid" caption="Small">
    flowchart LR
      A --> B --> C
  </doc-figure>`;
    expect(validateHtml(page(body), { file: 'w.html' }).diagnostics).toEqual([]);
  });
});

describe('validator — file groups', () => {
  const page = (body: string): string => `<doc-page doc-id="f">
${body}
  <doc-choice question="Q?"><doc-option>A</doc-option><doc-option>B</doc-option></doc-choice>
</doc-page>`;

  it('accepts a file stack with nothing to report', () => {
    const body = `  <doc-files title="Files to change">
    <doc-file-group title="Database" path="packages/db" count="~9 files" open>
      <doc-file path="schema/user.ts">split into <code>customer.ts</code></doc-file>
    </doc-file-group>
  </doc-files>`;
    expect(validateHtml(page(body), { file: 'f.html' }).diagnostics).toEqual([]);
  });

  it('rejects a file outside a group and a group without a title', () => {
    const body = `  <doc-files>
    <doc-file path="loose.ts"></doc-file>
    <doc-file-group><doc-file path="a.ts"></doc-file></doc-file-group>
  </doc-files>`;
    const result = validateHtml(page(body), { file: 'f.html' });
    const misplaced = result.diagnostics.find((d) => d.ruleId === 'child/misplaced');

    expect(misplaced?.line).toBe(3);
    expect(ruleIds(result.diagnostics)).toContain('attr/missing-required');
    expect(result.ok).toBe(false);
  });
});
