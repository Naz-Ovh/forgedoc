/**
 * Compile every theme to `dist/themes/<name>.css`.
 *
 * why this is its own step rather than part of the tsdown graph: only *one*
 * theme is imported by `src/index.ts` — the one that becomes `dist/forgedoc.css`
 * and the one the dev server and the test suite use. The others are never
 * referenced from JavaScript, because a theme is chosen at build time by
 * `forgedoc build --theme <name>`, not at runtime. A bundler only emits what
 * something imports, so anything not compiled here would simply never ship.
 *
 * Each theme is standalone: it carries its own token set, the shared headless
 * base, and its own visual layer. Two themes are never loaded together.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesDirectory = join(root, 'src/styles/themes');
const outputDirectory = join(root, 'dist/themes');

/** A theme is any directory under `themes/` holding an `index.scss`. */
export async function listThemes() {
  const entries = await readdir(themesDirectory, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

export async function buildStyles() {
  const themes = await listThemes();
  if (themes.length === 0) throw new Error(`No themes found in ${themesDirectory}`);

  await mkdir(outputDirectory, { recursive: true });

  const built = [];
  for (const theme of themes) {
    const entry = join(themesDirectory, theme, 'index.scss');
    const { css } = sass.compile(entry, {
      style: 'compressed',
      // Sass writes a UTF-8 BOM in compressed mode. The CLI embeds this file
      // inside a `<style>` element in an already-UTF-8 document, where a BOM is
      // not a byte-order mark any more — it is a stray U+FEFF sitting in front
      // of the first rule.
      charset: false,
      loadPaths: [join(root, 'src/styles')],
      // A theme is one file by the time it ships; a source map would point at
      // partials the consumer does not have.
      sourceMap: false,
    });

    const target = join(outputDirectory, `${theme}.css`);
    await writeFile(target, css);
    built.push({ theme, bytes: css.length });
  }

  return built;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const built = await buildStyles();
  for (const { theme, bytes } of built) {
    console.log(`dist/themes/${theme}.css  ${(bytes / 1024).toFixed(1)} kB`);
  }
}
