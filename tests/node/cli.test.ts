/**
 * §11.4: the CLI surface, and the one property an agent harness depends on —
 * a non-zero exit code on any error.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { run } from '../../tools/cli.js';

let workspace: string;
let stdout: string;
let stderr: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'forgedoc-cli-'));
  stdout = '';
  stderr = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(workspace, { recursive: true, force: true });
});

describe('forgedoc new', () => {
  it('scaffolds a document that validates', async () => {
    expect(await run(['new', 'Vendor Orders', '--dir', workspace])).toBe(0);

    const path = join(workspace, 'DOC_vendor-orders.html');
    const contents = await readFile(path, 'utf8');

    expect(contents).toContain('doc-id="vendor-orders"');
    expect(contents).toContain('<style>/*@DOC_CSS@*/</style>');
    expect(contents).toContain('<script>//@DOC_JS@</script>');

    // Each placeholder where its replacement belongs: styles in <head> so
    // nothing flashes unstyled, script last so children exist at upgrade.
    expect(contents.indexOf('<style>/*@DOC_CSS@*/</style>')).toBeLessThan(
      contents.indexOf('</head>'),
    );
    expect(contents.indexOf('<script>//@DOC_JS@</script>')).toBeGreaterThan(
      contents.indexOf('</doc-page>'),
    );

    stdout = '';
    expect(await run(['validate', path])).toBe(0);
    expect(stdout).toContain(': ok');
  });
});

describe('forgedoc validate', () => {
  it('exits non-zero on an error', async () => {
    const path = join(workspace, 'bad.html');
    await writeFile(path, '<doc-section title="No document"></doc-section>', 'utf8');

    expect(await run(['validate', path])).toBe(1);
    expect(stdout).toContain('doc/missing');
  });

  it('emits JSON on --format=json', async () => {
    const path = join(workspace, 'bad.html');
    await writeFile(path, '<doc-section title="No document"></doc-section>', 'utf8');

    await run(['validate', path, '--format=json']);
    expect(() => JSON.parse(stdout) as unknown).not.toThrow();
  });

  it('reports a missing file rather than throwing', async () => {
    expect(await run(['validate', join(workspace, 'nope.html')])).toBe(1);
    expect(stderr).toContain('cannot read');
  });
});

describe('forgedoc build', () => {
  it('writes no output when validation fails', async () => {
    const path = join(workspace, 'bad.html');
    await writeFile(
      path,
      '<doc-page><doc-section title="x"></doc-section></doc-page>\n<style>/*@DOC_CSS@*/</style>\n<script>//@DOC_JS@</script>',
      'utf8',
    );

    expect(await run(['build', path])).toBe(1);
    expect(stderr).toContain('no output written');
    await expect(readFile(join(workspace, 'bad.built.html'), 'utf8')).rejects.toThrow();
  });
});

/**
 * The documentation commands. What is asserted here is the CLI contract an agent
 * harness depends on — exit codes, `--format=json` being parseable, and an
 * unknown element failing loudly rather than printing an empty page. The content
 * itself is covered by `tests/node/docs.test.ts`.
 */
describe('forgedoc documentation commands', () => {
  it('lists every element, and filters by category', async () => {
    expect(await run(['elements'])).toBe(0);
    expect(stdout).toContain('`<doc-choice>`');
    expect(stdout).toContain('`<doc-table>`');

    stdout = '';
    expect(await run(['elements', '--category', 'Content'])).toBe(0);
    expect(stdout).toContain('`<doc-code>`');
    expect(stdout).not.toContain('`<doc-choice>`');
  });

  it('prints the cheatsheet', async () => {
    expect(await run(['cheatsheet'])).toBe(0);
    expect(stdout).toContain('# ForgeDoc cheatsheet');
    expect(stdout).toContain('<style>/*@DOC_CSS@*/</style>');
  });

  it('describes one element in full', async () => {
    expect(await run(['info', 'doc-choice'])).toBe(0);
    expect(stdout).toContain('# `<doc-choice>`');
    expect(stdout).toContain('| `question` |');
    expect(stdout).toContain('```html');
  });

  it('accepts an element name without the doc- prefix', async () => {
    expect(await run(['info', 'blocker'])).toBe(0);
    expect(stdout).toContain('# `<doc-blocker>`');
  });

  it('exits non-zero and suggests a near miss for an unknown element', async () => {
    expect(await run(['info', 'doc-tabl'])).toBe(1);
    expect(stderr).toContain('no element called');
    expect(stderr).toContain('<doc-table>');
  });

  it('exits non-zero when info is given nothing to look up', async () => {
    expect(await run(['info'])).toBe(1);
    expect(stderr).toContain('expected an element name');
  });

  it('searches across several words', async () => {
    expect(await run(['search', 'http', 'endpoint'])).toBe(0);
    expect(stdout).toContain('doc-endpoint');
  });

  // A search that finds nothing is a failed lookup, so a shell `&&` chain stops.
  it('exits non-zero when a search finds nothing', async () => {
    expect(await run(['search', 'kubernetes'])).toBe(1);
    expect(stdout).toContain('Nothing matches');
  });

  it('prints the full reference', async () => {
    expect(await run(['reference'])).toBe(0);
    expect(stdout).toContain('## Global attributes');
    expect(stdout).toContain('### `<doc-page>`');
  });

  it('emits parseable JSON from every documentation command', async () => {
    for (const argv of [
      ['elements', '--format=json'],
      ['cheatsheet', '--format=json'],
      ['info', 'doc-code', '--format=json'],
      ['search', 'mermaid', '--format=json'],
      ['reference', '--format=json'],
    ]) {
      stdout = '';
      expect(await run(argv), argv.join(' ')).toBe(0);
      expect(() => JSON.parse(stdout) as unknown, argv.join(' ')).not.toThrow();
    }
  });

  it('reports an empty JSON search result as success, not as an error', async () => {
    expect(await run(['search', 'kubernetes', '--format=json'])).toBe(0);
    expect((JSON.parse(stdout) as { hits: unknown[] }).hits).toEqual([]);
  });

  it('names the themes it can build with', async () => {
    // Depends on dist/themes, which only exists after a build. Either answer is
    // a valid CLI response; what must not happen is a crash or a silent zero.
    const code = await run(['themes']);
    if (code === 0) expect(stdout).toContain('(default)');
    else expect(stderr).toContain('themes');
  });
});

describe('forgedoc version and help', () => {
  it('prints a version', async () => {
    expect(await run(['version'])).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints usage and exits non-zero with no command', async () => {
    expect(await run([])).toBe(1);
    expect(stdout).toContain('forgedoc build');
  });

  it('rejects an unknown command', async () => {
    expect(await run(['frobnicate'])).toBe(1);
    expect(stderr).toContain('unknown command');
  });
});
