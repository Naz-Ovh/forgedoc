import { mkdir, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const target = resolve(root, 'website/content/docs/reference');
const reference = await readFile(resolve(root, 'docs/REFERENCE.md'), 'utf8');
const packageInfo = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

await mkdir(target, { recursive: true });
// Only this generator's files are removed. Handwritten reference guides live elsewhere.
for (const file of await readdir(target, { withFileTypes: true })) {
  if (file.isFile() && (file.name.endsWith('.md') || file.name === 'meta.json')) {
    await unlink(resolve(target, file.name));
  } else if (file.isDirectory() && /^\([a-z-]+\)$/.test(file.name)) {
    await rm(resolve(target, file.name), { recursive: true });
  }
}

function document(title, description, body) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n${body.trim()}\n`;
}

const sections = reference.split(/^## /m);
const introduction = sections.slice(1).filter((section) => !section.includes('### `<doc-'));
await writeFile(
  resolve(target, 'index.md'),
  document(
    'Component reference',
    'The complete markup contract, generated from ForgeDoc’s own reference.',
    `This reference describes ForgeDoc ${packageInfo.version}. It is generated from the same documentation used by the CLI and checked against the validator.\n\nStart with [the vocabulary cheatsheet](/docs/reference/cheatsheet/) for an overview, or pick an element in the sidebar.\n\n${introduction.map((section) => `## ${section.trim()}`).join('\n\n')}`,
  ),
);

const pages = ['index', 'cheatsheet'];
for (const section of sections.slice(1)) {
  const entries = [
    ...section.matchAll(/^### `<(doc-[a-z-]+)>`\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm),
  ];
  if (!entries.length) continue;
  const title = section.split('\n')[0].trim();
  const group = `(${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-$/, '')})`;
  const directory = resolve(target, group);
  await mkdir(directory, { recursive: true });
  pages.push(group);
  const categoryPages = [];
  for (const entry of entries) {
    const [, tag, content] = entry;
    categoryPages.push(tag);
    const description = content.trim().split('\n')[0];
    const body = content.replace(/^#### /gm, '## ').replace(/^##### /gm, '### ');
    await writeFile(resolve(directory, `${tag}.md`), document(tag, description, body));
  }
  await writeFile(
    resolve(directory, 'meta.json'),
    JSON.stringify(
      {
        title,
        pages: categoryPages,
        defaultOpen: false,
      },
      null,
      2,
    ),
  );
}
const cheatsheet = await readFile(resolve(root, 'docs/CHEATSHEET.md'), 'utf8');
await writeFile(
  resolve(target, 'cheatsheet.md'),
  document(
    'Vocabulary cheatsheet',
    'Every element and its authoring attributes, on one page.',
    cheatsheet.replace(/^# .*\n/, ''),
  ),
);
await writeFile(
  resolve(target, 'meta.json'),
  JSON.stringify({ title: 'Components', pages }, null, 2),
);
await mkdir(resolve(root, 'website/lib'), { recursive: true });
await writeFile(
  resolve(root, 'website/lib/version.ts'),
  `// Generated from the published package identity by scripts/prepare.mjs.\nexport const version = ${JSON.stringify(packageInfo.version)};\n`,
);
