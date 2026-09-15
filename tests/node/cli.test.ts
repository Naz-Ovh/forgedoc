/**
 * §11.4: the CLI surface, and the one property an agent harness depends on —
 * a non-zero exit code on any error.
 */

import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
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

    // The scaffold is the shell and nothing else: whatever it contains becomes
    // the shape of every document copied from it.
    expect(contents).not.toContain('<doc-section');
    expect(contents).not.toContain('<doc-choice');
    expect(contents).not.toContain('<doc-chip');

    stdout = '';
    // Exit 0 with the no-choice warning: an empty page is valid, and the
    // warning is the reminder to ask the reader something.
    expect(await run(['validate', path])).toBe(0);
    expect(stdout).toContain('0 errors');
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
  /** A valid document, written to `workspace/<name>.html`. */
  async function scaffold(name = 'PLAN_demo'): Promise<string> {
    const path = join(workspace, `${name}.html`);
    await run(['new', name, '--dir', workspace]);
    const scaffolded = join(workspace, `DOC_${name.toLowerCase().replace(/_/g, '-')}.html`);
    await rename(scaffolded, path);
    return path;
  }

  it('writes no output when validation fails', async () => {
    const path = join(workspace, 'bad.html');
    await writeFile(
      path,
      '<doc-page><doc-section title="x"></doc-section></doc-page>\n<style>/*@DOC_CSS@*/</style>\n<script>//@DOC_JS@</script>',
      'utf8',
    );

    expect(await run(['build', path])).toBe(1);
    expect(stderr).toContain('no output written');
    // The input is the output now, so a failed build must leave it untouched.
    expect(await readFile(path, 'utf8')).toContain('/*@DOC_CSS@*/');
  });

  /*
   * One document, one file. The `.built.html` twin this replaced meant every
   * plan existed twice, and a reader had to be told which copy to open.
   */
  it('builds in place, leaving no second file', async () => {
    const path = await scaffold();

    expect(await run(['build', path])).toBe(0);

    const built = await readFile(path, 'utf8');
    expect(built).toContain('rel="stylesheet"');
    expect(built).not.toContain('/*@DOC_CSS@*/');
    expect(await readdir(workspace)).toEqual(['PLAN_demo.html']);
  });

  it('rebuilds its own output without duplicating the runtime', async () => {
    const path = await scaffold();

    await run(['build', path]);
    const once = await readFile(path, 'utf8');
    await run(['build', path]);
    const twice = await readFile(path, 'utf8');

    expect(twice).toBe(once);
    expect(await readdir(workspace)).toEqual(['PLAN_demo.html']);
  });

  it('still honours an explicit --out', async () => {
    const path = await scaffold();
    const target = join(workspace, 'elsewhere.html');

    expect(await run(['build', path, '--out', target])).toBe(0);
    expect(await readFile(target, 'utf8')).toContain('rel="stylesheet"');
    expect(await readFile(path, 'utf8')).toContain('/*@DOC_CSS@*/');
  });

  /*
   * History is opt-in: the default is one file that always shows the current
   * plan. Asking for history moves the document into a folder of its own, where
   * `index.html` is still the one thing to open.
   */
  describe('--history', () => {
    it('moves the document into a folder and keeps index.html as the latest', async () => {
      const path = await scaffold();

      expect(await run(['build', path, '--history'])).toBe(0);

      expect(await readdir(workspace)).toEqual(['PLAN_demo']);
      const folder = join(workspace, 'PLAN_demo');
      expect(await readdir(folder)).toEqual(['history', 'index.html']);
      expect(await readFile(join(folder, 'index.html'), 'utf8')).toContain('rel="stylesheet"');
    });

    it('keeps one entry per version, in order', async () => {
      const path = await scaffold();
      await run(['build', path, '--history']);
      const index = join(workspace, 'PLAN_demo', 'index.html');
      const folder = join(workspace, 'PLAN_demo');

      const revise = async (text: string) => {
        const current = await readFile(index, 'utf8');
        await writeFile(index, current.replace('</doc-page>', `<p>${text}</p></doc-page>`), 'utf8');
        await run(['build', index, '--history']);
      };
      await revise('second');
      await revise('third');

      const kept = await readdir(join(folder, 'history'));
      expect(kept).toHaveLength(3);
      expect(kept[0]).toMatch(/^0001-\d{4}-\d{2}-\d{2}\.html$/);
      expect(kept[2]).toMatch(/^0003-\d{4}-\d{2}-\d{2}\.html$/);

      // The newest entry is what the reader opens.
      expect(await readFile(join(folder, 'history', String(kept[2])), 'utf8')).toBe(
        await readFile(index, 'utf8'),
      );
      // …and the version before it is still the version before it.
      expect(await readFile(join(folder, 'history', String(kept[1])), 'utf8')).toContain('second');
      expect(await readFile(join(folder, 'history', String(kept[1])), 'utf8')).not.toContain(
        'third',
      );
    });

    it('adds nothing when a rebuild changes nothing', async () => {
      const path = await scaffold();
      await run(['build', path, '--history']);
      const index = join(workspace, 'PLAN_demo', 'index.html');

      await run(['build', index, '--history']);
      await run(['build', index, '--history']);

      expect(await readdir(join(workspace, 'PLAN_demo', 'history'))).toHaveLength(1);
    });
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
