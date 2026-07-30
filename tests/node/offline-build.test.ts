/**
 * Acceptance 3: `plankit build` produces one `.html` that opens correctly from
 * `file://` on a machine with **no network**.
 *
 * This test proves the "no network" half by inspection — after injection there
 * must be no external reference of any kind left in the file. The "opens
 * correctly" half is covered by the browser suite, which runs the same runtime.
 *
 * Skipped with a clear message when `dist/` has not been built, so a fresh
 * checkout running `npm test` does not fail for the wrong reason.
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { run } from '../../tools/cli.js';
import { validateHtml } from '../../tools/validate.js';

const DIST = fileURLToPath(new URL('../../dist', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../fixtures/offline-plan.html', import.meta.url));

const isBuilt =
  existsSync(join(DIST, 'plankit.standalone.iife.js')) && existsSync(join(DIST, 'plankit.css'));
const describeBuilt = isBuilt ? describe : describe.skip;

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'plankit-offline-'));
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(workspace, { recursive: true, force: true });
});

describeBuilt('plankit build — the offline document', () => {
  it('replaces both placeholders and validates as built', async () => {
    const outputPath = join(workspace, 'offline.html');
    expect(await run(['build', FIXTURE, '--offline', '--out', outputPath])).toBe(0);

    const output = await readFile(outputPath, 'utf8');
    expect(output).not.toContain('@PLAN_CSS@');
    expect(output).not.toContain('@PLAN_JS@');

    const check = validateHtml(output, { file: outputPath, expectBuilt: true });
    expect(check.errorCount).toBe(0);
  });

  it('leaves no external reference behind', async () => {
    const outputPath = join(workspace, 'offline.html');
    await run(['build', FIXTURE, '--offline', '--out', outputPath]);
    const output = await readFile(outputPath, 'utf8');

    // Attributes that would reach the network. `src="data:"` is fine — that is
    // how the kitchen sink embeds its image.
    const external = [
      /<link\b[^>]*\brel=["']?stylesheet/i,
      /<script\b[^>]*\bsrc=/i,
      /\bsrc=["'](?!data:)(https?:)?\/\//i,
      /\bhref=["']https?:\/\/[^"']*\.(css|js)/i,
      /@import\s+url\(/i,
      /@font-face/i,
    ];

    for (const pattern of external) {
      expect(pattern.test(output), `matched ${pattern}`).toBe(false);
    }
  });

  it('puts the embedded styles in <head> so nothing flashes unstyled', async () => {
    const outputPath = join(workspace, 'offline.html');
    await run(['build', FIXTURE, '--offline', '--out', outputPath]);
    const output = await readFile(outputPath, 'utf8');

    const head = output.indexOf('</head>');
    // The real CSS, not just an empty shell: `@layer plan.reset` opens the
    // bundle. `<style>` alone would also match the runtime, which contains the
    // literal string for the styles it injects at upgrade time.
    const styles = output.indexOf('<style>@layer plan.');
    expect(styles).toBeGreaterThan(-1);
    expect(styles).toBeLessThan(head);
    // …and the body no longer carries a stylesheet of its own.
    expect(output.slice(head)).not.toContain('@layer plan.reset');
  });

  /*
   * Assertions on the bundles use `.includes()` rather than `toContain`, because
   * a failing `toContain` prints the whole three-megabyte bundle into the test
   * report and buries every other failure with it.
   */
  it('bundles Mermaid rather than fetching it', () => {
    const cdnBundle = readFileSync(join(DIST, 'plankit.iife.js'), 'utf8');
    const standaloneBundle = readFileSync(join(DIST, 'plankit.standalone.iife.js'), 'utf8');

    // The CDN build lazily fetches Mermaid from a pinned URL (§16.5)…
    expect(cdnBundle.includes('cdn.jsdelivr.net/npm/mermaid@')).toBe(true);
    expect(cdnBundle.includes('11.16.0')).toBe(true);
    // …and the offline build must not reach for it at all.
    expect(standaloneBundle.includes('cdn.jsdelivr.net')).toBe(false);
    expect(standaloneBundle.length).toBeGreaterThan(cdnBundle.length * 5);
  });

  it('stamps the version onto plan-doc for the agent reading a bucket back', () => {
    const bundle = readFileSync(join(DIST, 'plankit.standalone.iife.js'), 'utf8');
    const packageVersion = (
      JSON.parse(
        readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
      ) as {
        version: string;
      }
    ).version;

    // Quote style is the minifier's choice, not ours — oxc emits a template
    // literal where esbuild emitted a double-quoted string. Asserting on the
    // exact quoting made this test fail on a minifier swap that changed no
    // behaviour, so match any of the three.
    expect(bundle).toMatch(
      new RegExp(`dataset\\.plankit\\s*=\\s*["'\`]${packageVersion.replace(/\./g, '\\.')}["'\`]`),
    );
  });

  it('ships an IIFE, not an ES module', () => {
    const bundle = readFileSync(join(DIST, 'plankit.standalone.iife.js'), 'utf8');

    // MUST (§2.3): ES module imports are blocked by CORS on file://.
    expect(/^\s*import\s/m.test(bundle)).toBe(false);
    expect(/^\s*export\s/m.test(bundle)).toBe(false);
  });
});

/*
 * The CDN flavour is the default, so it is the one almost every plan in a repo
 * will be built with. Its whole value rests on the URL being version-pinned:
 * an unpinned path both misses jsDelivr's `immutable` cache and re-renders
 * already-published plans against a runtime nobody checked them against.
 */
describeBuilt('plankit build — the default CDN document', () => {
  it('references the runtime instead of embedding it', async () => {
    const outputPath = join(workspace, 'cdn.html');
    expect(await run(['build', FIXTURE, '--out', outputPath])).toBe(0);

    const output = await readFile(outputPath, 'utf8');
    expect(output).toMatch(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="https:\/\/[^"]+\.css">/);
    expect(output).toMatch(/<script\b[^>]*\bsrc="https:\/\/[^"]+\.js"\s+defer><\/script>/);
    expect(output).not.toContain('@PLAN_CSS@');
    expect(output).not.toContain('@PLAN_JS@');

    const check = validateHtml(output, { file: outputPath, expectBuilt: true });
    expect(check.errorCount).toBe(0);
  });

  it('stays small enough to commit', async () => {
    const outputPath = join(workspace, 'cdn.html');
    await run(['build', FIXTURE, '--out', outputPath]);

    const cdnBytes = Buffer.byteLength(await readFile(outputPath, 'utf8'), 'utf8');
    const source = Buffer.byteLength(await readFile(FIXTURE, 'utf8'), 'utf8');

    // Two URLs' worth of growth over the markup the agent wrote, not megabytes.
    expect(cdnBytes).toBeLessThan(source + 1024);
  });

  it('pins the CDN URL to an exact version, never a range or a tag', async () => {
    const outputPath = join(workspace, 'cdn.html');
    await run(['build', FIXTURE, '--out', outputPath]);
    const output = await readFile(outputPath, 'utf8');

    const { version, name } = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { version: string; name: string };

    expect(output).toContain(`/npm/${name}@${version}/dist/`);
    expect(output).not.toMatch(/@latest|@\^|@~|@next/);
  });

  it('puts the stylesheet in <head> so nothing flashes unstyled', async () => {
    const outputPath = join(workspace, 'cdn.html');
    await run(['build', FIXTURE, '--out', outputPath]);
    const output = await readFile(outputPath, 'utf8');

    expect(output.indexOf('<link rel="stylesheet"')).toBeLessThan(output.indexOf('</head>'));
  });
});

if (!isBuilt) {
  describe('plankit build — the offline document', () => {
    it.skip('needs `npm run build` first', () => {});
  });
}
