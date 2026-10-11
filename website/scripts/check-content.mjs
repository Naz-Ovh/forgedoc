import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const content = resolve(root, 'content/docs');

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

const files = await markdownFiles(content);
const pages = await Promise.all(
  files.map(async (path) => {
    const relative = path
      .slice(content.length + 1)
      .split('/')
      .filter((segment) => !/^\(.+\)$/.test(segment))
      .join('/')
      .replace(/\.md$/, '')
      .replace(/\/?index$/, '');
    return {
      path,
      url: `/docs${relative ? `/${relative}` : ''}`,
      body: await readFile(path, 'utf8'),
    };
  }),
);
const urls = new Set(pages.map((page) => page.url));
const markdownUrls = new Set(pages.map((page) => `/markdown/${page.url.slice(6) || 'index'}.md`));

for (const page of pages) {
  assert.match(
    page.body,
    /^---\ntitle: .+\ndescription: .+\n---/,
    `${page.path}: title and description must be present`,
  );
  const prose = page.body.replace(/```[\s\S]*?```/g, '');
  for (const match of prose.matchAll(/\]\((\/(?:docs|markdown)[^)]*)\)/g)) {
    const target = match[1].split('#')[0].replace(/\/$/, '');
    assert.ok(
      urls.has(target) || markdownUrls.has(target),
      `${page.path}: broken link ${match[1]}`,
    );
  }
}

const reference = await readFile(resolve(root, '../docs/REFERENCE.md'), 'utf8');
for (const [, tag] of reference.matchAll(/^### `<(doc-[a-z-]+)>`/gm)) {
  assert.ok(urls.has(`/docs/reference/${tag}`), `Missing generated reference page: ${tag}`);
}

process.stdout.write(
  `Content checks passed: ${pages.length} pages, internal links, and reference coverage.\n`,
);
