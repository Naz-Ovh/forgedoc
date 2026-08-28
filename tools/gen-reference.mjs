/**
 * Generates `skills/better-plan/REFERENCE.md` from the single source of truth in
 * `src/core/contract.ts`.
 *
 * Runs as part of `npm test` so a pull request that touches the contract cannot
 * forget to update the docs.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT_SOURCE = resolve(HERE, '../src/core/contract.ts');
const OUTPUT_PATH = resolve(HERE, '../skills/better-plan/REFERENCE.md');

/**
 * Parts and state flags declared per component in §7.2.
 *
 * Keep these in sync when editing a component. The test in
 * `tests/node/reference.test.ts` checks this.
 */
const PARTS = {
  'doc-page': [
    'canvas',
    'rail',
    'prose',
    'aside',
    'toc',
    'toc-backdrop',
    'bucket',
    'bucket-fab',
    'bucket-panel',
    'bucket-header',
    'bucket-body',
    'bucket-empty',
    'bucket-item',
    'bucket-item-remove',
    'bucket-copy',
    'bucket-copied',
    'bucket-badge',
    'bucket-note',
    'settings-toggle',
    'theme-toggle',
    'density-toggle',
  ],
  'doc-header': ['title', 'lede', 'kicker', 'rule'],
  'doc-section': ['heading', 'title', 'number', 'anchor', 'body'],
  'doc-toc': ['title', 'list', 'item', 'link', 'number', 'label'],
  'doc-note': ['icon', 'title', 'body'],
  'doc-blocker': ['badge', 'title', 'blocks', 'why', 'action'],
  'doc-blocks': ['label', 'content'],
  'doc-why': ['label', 'content'],
  'doc-action': ['label', 'content'],
  'doc-list': ['title', 'item', 'marker'],
  'doc-badge': [],
  'doc-term': [],
  'doc-ref': [],
  'doc-chips': [],
  'doc-chip': [],
  'doc-owners': [],
  'doc-owner': ['avatar', 'info', 'name', 'role', 'status'],
  'doc-decision': ['header', 'badge-id', 'status', 'title', 'date', 'body'],
  'doc-endpoint': [
    'trigger',
    'method',
    'path',
    'path-param',
    'summary',
    'status',
    'open-icon',
    'body',
    'endpoint-drawer',
    'endpoint-drawer-header',
    'endpoint-drawer-signature',
    'endpoint-drawer-content',
    'endpoint-drawer-section',
    'endpoint-drawer-parameter',
    'endpoint-drawer-example',
    'endpoint-drawer-response-status',
  ],
  'doc-params': [],
  'doc-param': ['header', 'name', 'type', 'badge', 'default', 'body'],
  'doc-steps': [],
  'doc-step': ['marker', 'card', 'header', 'title', 'body'],
  'doc-stats': [],
  'doc-stat': ['label', 'value-row', 'value', 'diff', 'body'],
  'doc-timeline': [],
  'doc-milestone': ['header', 'marker', 'date', 'title', 'owner', 'status', 'body'],
  'doc-matrix': [],
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
  'doc-rating': ['question', 'scale', 'score-btn'],
  'doc-tabs': ['strip', 'tab'],
  'doc-tab': ['body'],
  'doc-checklist': ['item', 'check'],
  'doc-carousel': ['controls', 'prev-btn', 'next-btn', 'dots', 'dot'],
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

const STATES = {
  'doc-page': ['toc-open', 'toc-docked'],
  'doc-choice': ['answered', 'note-open', 'other-open'],
  'doc-stage': ['open', 'current'],
  'doc-flow-node': ['active'],
  'doc-term': ['first-mention'],
};

const escapePipes = (text) => text.replace(/\|/g, '\\|');

/**
 * A table delimiter row in the one shape a markdown formatter leaves alone.
 */
const DELIMITER = (columns) => `| ${Array(columns).fill('---').join(' | ')} |`;

function describeKind(kind) {
  switch (kind.type) {
    case 'enum':
      return kind.values.map((value) => `\`${value}\``).join(' \\| ');
    case 'boolean':
      return 'boolean';
    case 'integer':
      return 'integer';
    case 'slug':
      return 'slug (`[a-z0-9-]+`)';
    case 'token':
      return 'token';
    case 'url':
      return 'URL';
    case 'string':
      return 'string';
    default:
      return 'string';
  }
}

function renderTag(name, contract) {
  const spec = contract.TAGS[name];
  const lines = [`### \`<${name}>\``, '', spec.doc];

  const attributes = Object.entries(spec.attributes);
  if (attributes.length > 0) {
    lines.push(
      '',
      '| Attribute | Values | Required | Notes |',
      DELIMITER(4),
      ...attributes.map(
        ([attrName, definition]) =>
          `| \`${attrName}\` | ${describeKind(definition.kind)} | ${
            definition.required ? '**yes**' : 'no'
          } | ${escapePipes(definition.doc)} |`,
      ),
    );
  }

  const parts = PARTS[name] ?? [];
  if (parts.length > 0) {
    const list = parts.map((part) => `\`${part}\``).join(', ');
    lines.push('', `- **Parts:** ${list}`);
  }

  const states = STATES[name] ?? [];
  if (states.length > 0) {
    const list = states.map((state) => `\`:${state}\``).join(', ');
    lines.push('', `- **States:** ${list}`);
  }

  if (spec.onlyInside) {
    const parents = spec.onlyInside.map((parent) => `\`<${parent}>\``).join(', ');
    lines.push('', `- **Only valid inside:** ${parents}`);
  }

  if (spec.requiresChild) {
    const children = spec.requiresChild.map((child) => `\`<${child}>\``).join(', ');
    lines.push('', `- **Requires child:** ${children}`);
  }

  if (spec.generated) {
    lines.push('', '- **Generated by the runtime.**');
  }

  if (spec.inline) {
    lines.push('', '- **Inline element.**');
  }

  return lines.join('\n');
}

function renderGlobalAttributes(contract) {
  const lines = [
    '## Global attributes',
    '',
    'Accepted on every `doc-*` tag.',
    '',
    '| Attribute | Values | Notes |',
    DELIMITER(3),
  ];

  for (const [name, definition] of Object.entries(contract.GLOBAL_ATTRIBUTES)) {
    lines.push(
      `| \`${name}\` | ${describeKind(definition.kind)} | ${escapePipes(definition.doc)} |`,
    );
  }

  return lines.join('\n');
}

function renderLanguages(contract) {
  const lines = [
    '## Code language allowlist',
    '',
    'A `lang` outside this list is a build **error**, never a silent fallback to',
    'plain text. Extending it is a one-line change in `src/core/contract.ts` plus an',
    'import in `src/vendor/highlight.ts`, then a rebuild.',
    '',
    '| Language | Values |',
    DELIMITER(2),
  ];

  for (const lang of contract.CODE_LANGUAGES) {
    lines.push(`| \`${lang}\` | Supported |`);
  }

  return lines.join('\n');
}

const CATEGORIES = [
  {
    title: 'Shell',
    tags: ['doc-page', 'doc-header', 'doc-section', 'doc-toc'],
  },
  {
    title: 'Meta & Ownership',
    tags: ['doc-chips', 'doc-chip', 'doc-owners', 'doc-owner'],
  },
  {
    title: 'Architecture & API',
    tags: ['doc-decision', 'doc-endpoint', 'doc-params', 'doc-param', 'doc-steps', 'doc-step'],
  },
  {
    title: 'Metrics & Planning',
    tags: ['doc-stats', 'doc-stat', 'doc-timeline', 'doc-milestone', 'doc-matrix'],
  },
  {
    title: 'Prose & Callouts',
    tags: [
      'doc-badge',
      'doc-note',
      'doc-blocker',
      'doc-blocks',
      'doc-why',
      'doc-action',
      'doc-list',
      'doc-term',
      'doc-ref',
    ],
  },
  {
    title: 'Interactive',
    tags: [
      'doc-choice',
      'doc-option',
      'doc-rating',
      'doc-carousel',
      'doc-tabs',
      'doc-tab',
      'doc-checklist',
    ],
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

async function loadContract() {
  const bundle = await rolldown({
    input: CONTRACT_SOURCE,
    treeshake: false,
  });
  const { output } = await bundle.generate({ format: 'cjs' });
  const code = output[0]?.code;
  if (!code) throw new Error('Failed to bundle contract.ts');

  const mod = { exports: {} };
  const fn = new Function('module', 'exports', code);
  fn(mod, mod.exports);
  return mod.exports;
}

async function main() {
  const contract = await loadContract();
  const sections = [
    '# ForgeDoc Markup Reference',
    '',
    '> Generated from `src/core/contract.ts`. Do not edit by hand.',
    '',
    renderGlobalAttributes(contract),
  ];

  for (const category of CATEGORIES) {
    sections.push('', `## ${category.title}`);
    for (const tag of category.tags) {
      sections.push('', renderTag(tag, contract));
    }
  }

  sections.push('', renderLanguages(contract));

  const content = `${sections.join('\n')}\n`;
  writeFileSync(OUTPUT_PATH, content, 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
