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
  workspace = await mkdtemp(join(tmpdir(), 'plankit-cli-'));
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

describe('plankit new', () => {
  it('scaffolds a document that validates', async () => {
    expect(await run(['new', 'Vendor Orders', '--dir', workspace])).toBe(0);

    const path = join(workspace, 'PLAN_vendor-orders.html');
    const contents = await readFile(path, 'utf8');

    expect(contents).toContain('plan-id="vendor-orders"');
    expect(contents).toContain('<style>/*@PLAN_CSS@*/</style>');
    expect(contents).toContain('<script>//@PLAN_JS@</script>');

    // Each placeholder where its replacement belongs: styles in <head> so
    // nothing flashes unstyled, script last so children exist at upgrade.
    expect(contents.indexOf('<style>/*@PLAN_CSS@*/</style>')).toBeLessThan(
      contents.indexOf('</head>'),
    );
    expect(contents.indexOf('<script>//@PLAN_JS@</script>')).toBeGreaterThan(
      contents.indexOf('</plan-doc>'),
    );

    stdout = '';
    expect(await run(['validate', path])).toBe(0);
    expect(stdout).toContain(': ok');
  });
});

describe('plankit validate', () => {
  it('exits non-zero on an error', async () => {
    const path = join(workspace, 'bad.html');
    await writeFile(path, '<plan-section title="No document"></plan-section>', 'utf8');

    expect(await run(['validate', path])).toBe(1);
    expect(stdout).toContain('doc/missing');
  });

  it('emits JSON on --format=json', async () => {
    const path = join(workspace, 'bad.html');
    await writeFile(path, '<plan-section title="No document"></plan-section>', 'utf8');

    await run(['validate', path, '--format=json']);
    expect(() => JSON.parse(stdout) as unknown).not.toThrow();
  });

  it('reports a missing file rather than throwing', async () => {
    expect(await run(['validate', join(workspace, 'nope.html')])).toBe(1);
    expect(stderr).toContain('cannot read');
  });
});

describe('plankit build', () => {
  it('writes no output when validation fails', async () => {
    const path = join(workspace, 'bad.html');
    await writeFile(
      path,
      '<plan-doc><plan-section title="x"></plan-section></plan-doc>\n<style>/*@PLAN_CSS@*/</style>\n<script>//@PLAN_JS@</script>',
      'utf8',
    );

    expect(await run(['build', path])).toBe(1);
    expect(stderr).toContain('no output written');
    await expect(readFile(join(workspace, 'bad.built.html'), 'utf8')).rejects.toThrow();
  });
});

describe('plankit version and help', () => {
  it('prints a version', async () => {
    expect(await run(['version'])).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints usage and exits non-zero with no command', async () => {
    expect(await run([])).toBe(1);
    expect(stdout).toContain('plankit build');
  });

  it('rejects an unknown command', async () => {
    expect(await run(['frobnicate'])).toBe(1);
    expect(stderr).toContain('unknown command');
  });
});
