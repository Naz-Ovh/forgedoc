// @ts-check
/**
 * Standalone stylesheet builder.
 *
 * Compiles each theme into its self-contained CSS bundle in `dist/themes/<theme>.css`
 * and writes the default theme to `dist/forgedoc.css`.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const themesDir = join(root, 'src', 'styles', 'themes');
const distDir = join(root, 'dist');
const distThemesDir = join(distDir, 'themes');

/**
 * Discovers available themes from `src/styles/themes/` and compiles each to CSS.
 *
 * @returns {Promise<Array<{ theme: string, css: string, bytes: number }>>}
 */
export async function buildStyles() {
  if (!existsSync(distThemesDir)) {
    mkdirSync(distThemesDir, { recursive: true });
  }

  const themes = readdirSync(themesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const results = [];

  for (const theme of themes) {
    const entryFile = join(themesDir, theme, 'index.scss');
    if (!existsSync(entryFile)) continue;

    const result = sass.compile(entryFile, {
      style: 'compressed',
      loadPaths: [join(root, 'src', 'styles')],
    });

    const cleanCss = result.css.replace(/^\uFEFF/, '');
    const outPath = join(distThemesDir, `${theme}.css`);
    writeFileSync(outPath, cleanCss, 'utf8');

    // Default theme (forgedoc) also writes to dist/forgedoc.css
    if (theme === 'forgedoc') {
      writeFileSync(join(distDir, 'forgedoc.css'), cleanCss, 'utf8');
    }

    results.push({
      theme,
      css: cleanCss,
      bytes: Buffer.byteLength(cleanCss, 'utf8'),
    });
  }

  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const built = await buildStyles();
  for (const { theme, bytes } of built) {
    process.stdout.write(`dist/themes/${theme}.css  ${(bytes / 1024).toFixed(1)} kB\n`);
  }
}
