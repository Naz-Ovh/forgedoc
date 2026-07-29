/**
 * Acceptance criterion 14: zero `attachShadow` calls in `src/`.
 *
 * why (§2.1): the feedback bucket lets a reader select arbitrary text anywhere
 * in the document. `window.getSelection()` is scoped to a shadow root, so a
 * single stray `attachShadow` would quietly break selection, find-in-page and
 * print-to-PDF for everything inside it. This is cheap enough to run on every
 * commit, and Biome sees neither Svelte templates nor `.html` files.
 */

import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = fileURLToPath(new URL('../src', import.meta.url));
const SCANNED_EXTENSIONS = new Set(['.ts', '.js', '.svelte', '.css', '.html']);
const FORBIDDEN = [
  { pattern: /attachShadow/, why: 'shadow DOM is forbidden (§2.1)' },
  { pattern: /\bshadowRootMode\b/, why: 'declarative shadow DOM is forbidden (§2.1)' },
  { pattern: /shadowrootmode=/i, why: 'declarative shadow DOM is forbidden (§2.1)' },
];

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
      continue;
    }
    if (SCANNED_EXTENSIONS.has(extname(entry.name))) yield path;
  }
}

const violations = [];

for await (const path of walk(SOURCE_ROOT)) {
  const contents = await readFile(path, 'utf8');
  contents.split('\n').forEach((line, index) => {
    for (const { pattern, why } of FORBIDDEN) {
      if (pattern.test(line)) {
        violations.push(`${path}:${index + 1}  ${line.trim()}\n    ${why}`);
      }
    }
  });
}

if (violations.length > 0) {
  process.stderr.write(`check-no-shadow-dom: ${violations.length} violation(s)\n`);
  process.stderr.write(`${violations.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('check-no-shadow-dom: clean\n');
