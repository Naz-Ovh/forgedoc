// @ts-check
/**
 * Standalone stylesheet builder.
 *
 * Compiles each theme into its self-contained CSS bundle in `dist/themes/<theme>.css`
 * and writes the default theme to `dist/forgedoc.css`.
 *
 * The default is read from `tools/inject.ts` rather than named again here, so
 * the CLI's default and the shipped `forgedoc.css` cannot drift apart.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The default theme, read out of `tools/inject.ts`.
 *
 * why it is parsed rather than imported: this file is `.mjs` and runs under
 * plain `node`, which cannot load the TypeScript module. why it is not just
 * written out again here: `dist/forgedoc.css` is the stylesheet a consumer gets
 * when they ask for nothing, and the CLI's default is what a *document* gets
 * when it names nothing. Two copies of that name would eventually disagree, and
 * the symptom would be a `forgedoc.css` that is not the theme documents
 * actually build with. Throws rather than guessing if the shape changes.
 */
function readDefaultTheme() {
  const source = readFileSync(join(root, 'tools', 'inject.ts'), 'utf8');
  const match = /export const DEFAULT_THEME = '([a-z0-9-]+)'/.exec(source);
  if (!match) {
    throw new Error(
      'Could not find DEFAULT_THEME in tools/inject.ts. If it was renamed or ' +
        'reformatted, update the pattern here — dist/forgedoc.css has to be ' +
        'the same theme the CLI compiles in by default.',
    );
  }
  return match[1];
}

const DEFAULT_THEME = readDefaultTheme();
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

    /*
     * why: theme-owned fonts must travel with file:// documents (§2.3). A
     * relative `url()` in a compiled stylesheet resolves against wherever the
     * built document happens to sit, so a theme that ships its own typefaces
     * has to embed them or lose them.
     *
     * Matched by shape — any `./fonts/*.woff2` a theme asks for — rather than
     * by filename. The pattern here named Geist's two files literally, so the
     * next theme to vendor a typeface would have compiled clean and shipped a
     * stylesheet pointing at a file that is not in `dist/`: no error, no
     * fallback, just a document silently rendering in the system stack. A
     * missing file throws for the same reason.
     */
    const cleanCss = result.css
      .replace(/^\uFEFF/, '')
      .replace(/url\(["']?\.\/fonts\/([\w.-]+\.woff2)["']?\)/g, (_match, file) => {
        const fontPath = join(themesDir, theme, 'fonts', file);
        if (!existsSync(fontPath)) {
          throw new Error(
            `Theme "${theme}" asks for fonts/${file}, which does not exist. Add ` +
              'the file or drop the @font-face rule — a relative font URL cannot ' +
              'survive in a self-contained document (§2.3).',
          );
        }
        return `url("data:font/woff2;base64,${readFileSync(fontPath).toString('base64')}")`;
      });
    const outPath = join(distThemesDir, `${theme}.css`);
    writeFileSync(outPath, cleanCss, 'utf8');

    // The default theme is also written to the documented dist/forgedoc.css.
    if (theme === DEFAULT_THEME) {
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
