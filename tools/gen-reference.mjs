/**
 * Generate `skills/better-plan/REFERENCE.md` from `src/core/contract.ts`.
 *
 * why generated rather than hand-written: the contract already carries a `doc`
 * string for every tag and every attribute, and a reference that drifts from the
 * validator is worse than no reference — an agent trusts it, writes markup the
 * validator then rejects, and has no way to tell which of the two is wrong.
 *
 * `tests/node/reference.test.ts` fails if the checked-in file is stale, so the
 * generated half can never fall behind. The prose half lives in
 * `tools/reference-preamble.md` and is written by hand — it sits beside its
 * generator rather than in the skill directory so that everything an agent
 * loads from `skills/better-plan/` is something it is meant to read.
 *
 * Run with: npm run docs:reference
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'rolldown';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

/** Load the TypeScript contract without adding a TS runtime dependency. */
async function loadContract() {
  const bundle = await build({
    input: here('../src/core/contract.ts'),
    platform: 'node',
    output: { format: 'esm' },
    write: false,
  });

  const source = bundle.output[0].code;
  const encoded = Buffer.from(source).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

const GROUPS = [
  { title: 'Shell', tags: ['doc-page', 'doc-header', 'doc-section', 'doc-toc'] },
  { title: 'Meta', tags: ['doc-chips', 'doc-chip'] },
  {
    title: 'Prose and callouts',
    tags: [
      'doc-note',
      'doc-blocker',
      'doc-blocks',
      'doc-why',
      'doc-action',
      'doc-list',
      'doc-term',
      'doc-ref',
      'doc-quote',
      'doc-table',
    ],
  },
  {
    title: 'Interactive',
    tags: ['doc-choice', 'doc-option', 'doc-collapse', 'doc-tabs', 'doc-tab', 'doc-checklist'],
  },
  {
    title: 'Structure',
    tags: ['doc-flow', 'doc-flow-node', 'doc-roadmap', 'doc-stage'],
  },
  {
    title: 'Content',
    tags: ['doc-code', 'doc-diff', 'doc-figure', 'doc-caption', 'doc-tree', 'doc-compare'],
  },
];

/** Public `data-part` surface per tag (§7.4). Stable and covered by semver. */
const PARTS = {
  'doc-page': ['storage-warning', 'toc', 'bucket'],
  'doc-header': ['kicker', 'lede', 'title*'],
  'doc-section': ['heading', 'number', 'title', 'body'],
  'doc-toc': ['header', 'toggle', 'dock', 'list', 'entry', 'entry-number', 'entry-title'],
  'doc-chip': ['icon'],
  'doc-note': ['icon', 'title', 'body'],
  'doc-blocker': ['header', 'sequence', 'severity', 'title'],
  'doc-blocks': ['label', 'body'],
  'doc-why': ['label', 'body'],
  'doc-action': ['label', 'body'],
  'doc-list': ['title', 'item', 'marker'],
  'doc-quote': ['cite', 'body*'],
  'doc-table': ['table', 'scroll-hint'],
  'doc-choice': ['sequence', 'question', 'note-toggle', 'note', 'other'],
  'doc-option': [
    'control',
    'input',
    'key',
    'desc',
    'recommended',
    'other-label',
    'other-hint',
    'other-text',
  ],
  'doc-collapse': ['summary', 'chevron', 'summary-text', 'body'],
  'doc-tabs': ['strip', 'tab'],
  'doc-tab': ['body'],
  'doc-checklist': ['item', 'check'],
  'doc-flow': ['arrow'],
  'doc-flow-node': ['title', 'subtitle*'],
  'doc-roadmap': [],
  'doc-stage': ['header', 'badge', 'heading', 'title', 'subtitle', 'current-marker', 'body'],
  'doc-code': [
    'header',
    'title',
    'lang',
    'copy',
    'code',
    'gutter',
    'line-number',
    'lines',
    'line',
    'feedback',
  ],
  'doc-diff': [
    'header',
    'filename',
    'stat-add',
    'stat-remove',
    'code',
    'row',
    'old-number',
    'new-number',
    'sign',
    'text',
    'feedback',
  ],
  'doc-figure': ['content', 'caption', 'diagram-error', 'feedback'],
  'doc-caption': [],
  'doc-tree': ['list', 'node', 'connector', 'label', 'feedback'],
  'doc-compare': ['column'],
};

/** Custom states, targetable as `:state(name)` (§7.3). */
const STATES = {
  'doc-page': ['toc-open', 'toc-docked'],
  'doc-choice': ['answered', 'note-open', 'other-open'],
  'doc-collapse': ['open'],
  'doc-stage': ['open', 'current'],
  'doc-flow-node': ['active'],
  'doc-term': ['first-mention'],
};

const escapePipes = (text) => text.replace(/\|/g, '\\|');

/**
 * A table delimiter row in the one shape a markdown formatter leaves alone.
 *
 * why not the tighter `|---|---|`: this file is generated, and
 * `tests/node/reference.test.ts` compares it to the generator byte for byte.
 * An editor with markdownlint's fix-on-save enabled rewrites a tight delimiter
 * row to `| --- |` the moment the file is opened — which dirties a generated
 * file and fails that test, with nothing in the diff to suggest why. Emitting
 * the formatter's own shape means opening the file changes nothing.
 */
const DELIMITER = (columns) => `| ${Array(columns).fill('---').join(' | ')} |`;

function describeKind(kind) {
  switch (kind.type) {
    case 'enum':
      return kind.values.map((value) => `\`${value}\``).join(' \\| ');
    case 'boolean':
      return 'boolean (present or absent)';
    case 'integer':
      return 'whole number';
    case 'slug':
      return 'slug — lowercase, digits, hyphens';
    case 'url':
      return 'URL';
    case 'token':
      return 'token';
    default:
      return 'string';
  }
}

function renderTag(name, contract) {
  const spec = contract.TAGS[name];
  const lines = [`### \`<${name}>\``, '', spec.doc, ''];

  if (spec.generated) {
    lines.push('> **Generated by the runtime.** Writing this tag by hand is a build error.', '');
  }
  if (spec.onlyInside) {
    lines.push(
      `> Only valid inside ${spec.onlyInside.map((parent) => `\`<${parent}>\``).join(' or ')}.`,
      '',
    );
  }
  if (spec.requiresChild) {
    lines.push(
      `> Requires ${spec.requiresChild.map((child) => `\`<${child}>\``).join(' and ')}.`,
      '',
    );
  }

  const attributes = Object.entries(spec.attributes);
  if (attributes.length > 0) {
    lines.push('| Attribute | Required | Values | Notes |', DELIMITER(4));
    for (const [attribute, definition] of attributes) {
      lines.push(
        `| \`${attribute}\` | ${definition.required ? '**yes**' : 'no'} | ${describeKind(definition.kind)} | ${escapePipes(definition.doc)} |`,
      );
    }
    lines.push('');
  } else {
    lines.push('_No attributes beyond the global ones._', '');
  }

  const parts = PARTS[name] ?? [];
  if (parts.length > 0) {
    lines.push(`**Parts:** ${parts.map((part) => `\`${part}\``).join(', ')}`, '');
  }

  const states = STATES[name];
  if (states) {
    lines.push(`**States:** ${states.map((state) => `\`:state(${state})\``).join(', ')}`, '');
  }

  return lines.join('\n');
}

const contract = await loadContract();

const preamble = readFileSync(here('./reference-preamble.md'), 'utf8').trimEnd();

const globals = [
  '## Global attributes',
  '',
  'Accepted on every `doc-*` tag.',
  '',
  '| Attribute | Values | Notes |',
  DELIMITER(3),
  ...Object.entries(contract.GLOBAL_ATTRIBUTES).map(
    ([name, definition]) =>
      `| \`${name}\` | ${describeKind(definition.kind)} | ${escapePipes(definition.doc)} |`,
  ),
  '',
  'Any `data-*` attribute is accepted and ignored.',
].join('\n');

const vocabulary = GROUPS.map((group) =>
  [`## ${group.title}`, '', ...group.tags.map((tag) => renderTag(tag, contract))].join('\n'),
).join('\n');

const languages = [
  '## Code language allowlist',
  '',
  'A `lang` outside this list is a build **error**, never a silent fallback to',
  'plain text. Extending it is a one-line change in `src/core/contract.ts` plus an',
  'import in `src/vendor/highlight.ts`, then a rebuild.',
  '',
  contract.CODE_LANGUAGES.map((language) => `\`${language}\``).join(' · '),
].join('\n');

const footer = [
  '## Worked example',
  '',
  '`tests/fixtures/kitchen-sink.html` uses every tag, every enumerated attribute',
  'value and every part listed above. It is the golden-file snapshot target, the',
  'manual QA page and the print check, and CI fails if a component lands without',
  'appearing in it.',
  '',
  '---',
  '',
  '<!-- The sections above are generated from src/core/contract.ts by',
  '     tools/gen-reference.mjs. Run `npm run docs:reference` after changing the',
  '     contract; tests/node/reference.test.ts fails if this file is stale. -->',
].join('\n');

const output = `${preamble}\n\n${globals}\n\n${vocabulary}\n${languages}\n\n${footer}\n`;

writeFileSync(here('../skills/better-plan/REFERENCE.md'), output, 'utf8');
process.stdout.write('skills/better-plan/REFERENCE.md written\n');
