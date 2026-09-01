/**
 * Writes `skills/better-plan/REFERENCE.md` and `skills/better-plan/CHEATSHEET.md`.
 *
 * Both files are the byte-for-byte output of `forgedoc reference` and
 * `forgedoc cheatsheet`. There is one generator so the committed markdown and the
 * CLI cannot disagree — the reason the docs moved into the CLI in the first place
 * was that a hand-maintained cheatsheet had drifted from the validator, and
 * regenerating it from a *second* implementation would reintroduce exactly that.
 *
 * Runs as part of `npm test` via `tests/node/reference.test.ts`, so a pull
 * request that touches the contract cannot forget to update the docs.
 *
 * why the files stay committed rather than being generated on demand: they are
 * read on GitHub, in an editor, and by an agent that has only the repository
 * checked out — none of which run the build.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_SOURCE = resolve(HERE, 'docs.ts');

/** The generated file per renderer, relative to the repository root. */
const OUTPUTS = [
  { path: '../skills/better-plan/REFERENCE.md', render: 'renderReference' },
  { path: '../skills/better-plan/CHEATSHEET.md', render: 'renderCheatsheet' },
];

/**
 * Bundle the renderers and evaluate them in this process.
 *
 * why bundle rather than import: `tools/docs.ts` is TypeScript, and this script
 * runs under bare `node` from an npm script. Rolldown is already a build
 * dependency, so this needs nothing new on the dependency list. The module graph
 * is pure data and string formatting — no Node builtins, no DOM — so a plain
 * `new Function` evaluation is enough.
 */
async function loadRenderers() {
  const bundle = await rolldown({ input: DOCS_SOURCE, treeshake: false, platform: 'node' });
  const { output } = await bundle.generate({ format: 'cjs' });
  const code = output[0]?.code;
  if (!code) throw new Error('Failed to bundle tools/docs.ts');

  const module = { exports: {} };
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

async function main() {
  const renderers = await loadRenderers();

  for (const { path, render } of OUTPUTS) {
    const renderer = renderers[render];
    if (typeof renderer !== 'function') {
      throw new Error(`tools/docs.ts does not export ${render}()`);
    }
    writeFileSync(resolve(HERE, path), renderer(), 'utf8');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
