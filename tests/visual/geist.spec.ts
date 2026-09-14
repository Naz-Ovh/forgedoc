/** Geist is tested as a shipped file: what the builder embedded, not how it looks. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let workspace: string;
let documentUrl: string;

test.beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'forgedoc-geist-'));
  const source = join(workspace, 'source.html');
  const output = join(workspace, 'geist.html');
  const fixture = readFileSync(join(ROOT, 'tests/fixtures/kitchen-sink.html'), 'utf8')
    .replace(/<script\b[^>]*src="\/src\/index\.ts"[^>]*><\/script>/, '<script>//@DOC_JS@</script>')
    .replace('</head>', '<style>/*@DOC_CSS@*/</style></head>');
  writeFileSync(source, fixture);
  execFileSync(
    process.execPath,
    [join(ROOT, 'dist/cli.js'), 'build', source, '--offline', '--theme', 'geist', '--out', output],
    { stdio: 'pipe' },
  );
  documentUrl = pathToFileURL(output).href;
});

test.afterAll(() => rmSync(workspace, { recursive: true, force: true }));

async function openOffline(page: Page): Promise<string[]> {
  const attempted: string[] = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (/^(file:|data:|blob:)/.test(url)) return route.continue();
    attempted.push(url);
    return route.abort();
  });
  await page.goto(documentUrl);
  await page.locator('doc-page[data-doc-up]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return attempted;
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Geist ${colorScheme}: embedded fonts load with no network`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    const attempted = await openOffline(page);
    const fonts = await page.evaluate(() =>
      [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
    );
    expect(fonts).toEqual(
      expect.arrayContaining([
        { family: 'Geist', status: 'loaded' },
        { family: 'Geist Mono', status: 'loaded' },
      ]),
    );
    expect(attempted).toEqual([]);
  });
}

test('Geist: choice, note and keyboard focus survive a reload', async ({ page }) => {
  await openOffline(page);
  const choice = page.locator('doc-choice').first();
  const input = choice.locator('doc-option input').first();
  await input.check();
  await choice.locator('[data-part="note-toggle"]').click();
  await choice.locator('textarea[data-part="note"]').fill('Ship the documented behavior.');
  await page.reload();
  await expect(input).toBeChecked();
  await expect(choice.locator('textarea[data-part="note"]')).toHaveValue(
    'Ship the documented behavior.',
  );
  await input.focus();
  await expect(input).toBeFocused();
  await page.locator('[data-part="bucket-trigger"]').click();
  await expect(page.locator('[data-part="bucket-trigger"]')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});
