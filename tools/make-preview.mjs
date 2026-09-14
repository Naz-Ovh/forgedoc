/**
 * Build one self-contained preview document per theme.
 *
 * `npm run preview` → `.temp/preview-<theme>.html`, openable by double-click.
 *
 * why not just point the dev server at the kitchen sink: that fixture loads
 * `/src/index.ts`, and `src/index.ts` imports exactly one theme — the reference
 * one. It can show `forgedoc` and nothing else. Every other theme is only ever
 * a compiled `dist/themes/<name>.css`, so seeing one means building a document
 * the way a reader actually receives it.
 *
 * why it shells out to `dist/cli.js` rather than importing the injector: this
 * is then the same command a user runs, through the same validation and the
 * same placeholder replacement. A preview built by a private code path is a
 * preview of something nobody will ever be sent.
 *
 * The output is the `--offline` flavour on purpose: one file, no server, and
 * the feedback bucket still works because it persists to localStorage — so it
 * is something you can open, read, and leave comments in. The cost is ~3.5 MB
 * per file, since the kitchen sink has a Mermaid figure and the offline bundle
 * carries Mermaid.
 *
 * Note for `geist` and `bun`: their signature typefaces load from the network
 * (see each theme's `_fonts.scss`), so a preview opened without network access
 * renders in the system stack and looks less exact. That is the documented
 * trade, not a broken build.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'tests/fixtures/kitchen-sink.html');
const temporary = join(root, '.temp');

/**
 * Turn the dev fixture into a buildable document.
 *
 * The fixture ends with a Vite module script instead of the two placeholders,
 * because in dev the runtime arrives through the module graph. Swapping that
 * for the placeholders is the whole transformation — everything above it is
 * already exactly what an authoring agent would write, which is what makes the
 * fixture worth using as the preview.
 */
function asBuildableDocument(html) {
  const withScript = html.replace(
    /<script\b[^>]*src="\/src\/index\.ts"[^>]*><\/script>/,
    '<script>//@DOC_JS@</script>',
  );

  if (withScript === html) {
    throw new Error(
      'The kitchen sink no longer ends with the Vite module script. Update the ' +
        'pattern in tools/make-preview.mjs to match how it loads the runtime.',
    );
  }

  return withScript.replace(/<\/head>/i, '<style>/*@DOC_CSS@*/</style>\n</head>');
}

const themes = (await readdir(join(root, 'dist/themes')).catch(() => []))
  .filter((entry) => entry.endsWith('.css'))
  .map((entry) => entry.replace(/\.css$/, ''))
  .sort();

if (themes.length === 0) {
  throw new Error('No themes in dist/themes. Run `npm run build` first.');
}

await mkdir(temporary, { recursive: true });
const buildable = join(temporary, 'preview-source.html');
await writeFile(buildable, asBuildableDocument(await readFile(fixture, 'utf8')), 'utf8');

for (const theme of themes) {
  const target = join(temporary, `preview-${theme}.html`);
  execFileSync(
    process.execPath,
    [join(root, 'dist/cli.js'), 'build', buildable, '--offline', '--theme', theme, '--out', target],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
}
