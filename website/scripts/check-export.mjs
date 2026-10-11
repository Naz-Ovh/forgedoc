import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'out');
const index = await readFile(resolve(output, 'llms.txt'), 'utf8');
const full = await readFile(resolve(output, 'llms-full.txt'), 'utf8');

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => markdownFiles(resolve(directory, entry.name))),
  );
  return [
    ...entries
      .filter((entry) => entry.name.endsWith('.md'))
      .map((entry) => resolve(directory, entry.name)),
    ...nested.flat(),
  ];
}

const files = await markdownFiles(resolve(output, 'markdown'));
for (const file of files) {
  const relative = file.slice(output.length);
  const markdown = await readFile(file, 'utf8');
  assert.ok(index.includes(`](${relative})`), `LLM index is missing ${relative}`);
  assert.ok(full.includes(markdown), `Full export is missing ${relative}`);
}
for (const [alias, expected] of [
  ['llm.txt', index],
  ['llm-full.txt', full],
]) {
  assert.equal(
    await readFile(resolve(output, alias), 'utf8'),
    expected,
    `${alias} must match its canonical export`,
  );
}
assert.match(index, /^# ForgeDoc/m);
JSON.parse(await readFile(resolve(output, 'api/search'), 'utf8'));
process.stdout.write(
  `Static export checks passed: ${files.length} Markdown pages, complete LLM index/full text, both aliases, and search data.\n`,
);
