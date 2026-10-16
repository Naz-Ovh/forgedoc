/**
 * The documentation renderers behind `forgedoc elements`, `cheatsheet`, `info`,
 * `search` and `reference`.
 *
 * Everything here is derived: the mechanics from `src/core/contract.ts`, the
 * prose from `tools/element-docs.ts`. Nothing is transcribed, so no output can
 * drift from the validator that enforces it — which is the whole reason the docs
 * live in the CLI rather than in a markdown file someone has to remember to
 * update.
 *
 * Two audiences, one source. `--format=json` is for an agent that wants to look
 * a tag up mechanically; the text output is for the same agent dumping a section
 * into its own context, and for a human reading it in a terminal.
 */

import {
  type AttributeKind,
  type AttributeSpec,
  attributeSpec,
  CODE_LANGUAGES,
  GLOBAL_ATTRIBUTES,
  isKnownTag,
  PARTS,
  STATES,
  type TagName,
  TAG_NAMES,
  TAGS,
  type TagSpec,
} from '../src/core/contract.js';
import {
  CATEGORIES,
  CATEGORY_OF,
  CHEATSHEET_GROUPS,
  DOCUMENTED_TAGS,
  type ElementDoc,
  ELEMENT_DOCS,
  GUIDE,
  NEVER_WRITE,
  PLACEHOLDERS,
  PLAIN_HTML,
} from './element-docs.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared shaping
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable form of an attribute's accepted values. */
export function describeKind(kind: AttributeKind): string {
  switch (kind.type) {
    case 'enum':
      return kind.values.map((value) => `\`${value}\``).join(' | ');
    case 'slug':
      return 'slug (`[a-z0-9-]+`)';
    case 'url':
      return 'URL';
    default:
      return kind.type;
  }
}

/**
 * The same, compressed for a one-line summary.
 *
 * `string` and `boolean` render as nothing: string is what an attribute is
 * unless stated otherwise, and a boolean's whole spelling is its own name. Saying
 * either costs a word per attribute across the entire cheatsheet and tells the
 * reader something they already assumed.
 */
function compactKind(kind: AttributeKind): string {
  if (kind.type === 'string' || kind.type === 'boolean') return '';
  if (kind.type !== 'enum') return kind.type;

  // The 17-language allowlist is spelled out once at the foot of the sheet.
  // Inlining it on both `doc-code` and `doc-diff` spends 250 characters saying
  // it twice.
  if (kind.values.length === CODE_LANGUAGES.length && kind.values.includes('tsx')) {
    return 'see allowlist';
  }
  return kind.values.join('/');
}

const spec = (tag: TagName): TagSpec => TAGS[tag] as TagSpec;
const docOf = (tag: TagName): ElementDoc | undefined => ELEMENT_DOCS[tag];

const requiredAttributes = (tag: TagName): string[] =>
  Object.entries(spec(tag).attributes)
    .filter(([, definition]) => definition.required)
    .map(([name]) => name);

const optionalAttributes = (tag: TagName): string[] =>
  Object.entries(spec(tag).attributes)
    .filter(([, definition]) => !definition.required)
    .map(([name]) => name);

/**
 * One line describing a tag's attributes, required ones first and bolded.
 *
 * Enum values are inlined because "status" alone tells an author nothing, and
 * looking each one up individually is the cost the cheatsheet exists to avoid.
 */
function attributeLine(tag: TagName): string {
  const entries = Object.entries(spec(tag).attributes);
  const ordered = [
    ...entries.filter(([, definition]) => definition.required),
    ...entries.filter(([, definition]) => !definition.required),
  ];

  return ordered
    .map(([name, definition]) => {
      const label = definition.required ? `**\`${name}\`**` : `\`${name}\``;
      const values = compactKind(definition.kind);
      return values ? `${label} ${values}` : label;
    })
    .join(' · ');
}

// ─────────────────────────────────────────────────────────────────────────────
// forgedoc elements
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementSummary {
  readonly tag: TagName;
  readonly category: string;
  readonly summary: string;
  readonly required: readonly string[];
  readonly optional: readonly string[];
  readonly onlyInside?: readonly string[];
  readonly requiresChild?: readonly string[];
  readonly generated: boolean;
  readonly inline: boolean;
}

export function elementSummaries(category?: string): readonly ElementSummary[] {
  const wanted = category?.toLowerCase();

  return DOCUMENTED_TAGS.filter(
    (tag) => wanted === undefined || (CATEGORY_OF[tag] ?? '').toLowerCase().startsWith(wanted),
  ).map((tag) => {
    const definition = spec(tag);
    return {
      tag,
      category: CATEGORY_OF[tag] ?? '',
      summary: definition.doc,
      required: requiredAttributes(tag),
      optional: optionalAttributes(tag),
      ...(definition.onlyInside ? { onlyInside: definition.onlyInside } : {}),
      ...(definition.requiresChild ? { requiresChild: definition.requiresChild } : {}),
      generated: definition.generated === true,
      inline: definition.inline === true,
    };
  });
}

/**
 * The browsable listing: every tag, what it does, and the shape of its markup.
 *
 * why it repeats the required attributes rather than only naming the tag: the
 * question an author actually has is "can I use this without looking it up", and
 * the required list is the answer. `forgedoc info <tag>` is for the rest.
 */
export function renderElements(category?: string): string {
  const summaries = elementSummaries(category);
  if (summaries.length === 0) {
    const known = CATEGORIES.map((entry) => entry.title).join(', ');
    return `No category matches "${category ?? ''}".\nCategories: ${known}\n`;
  }

  const lines: string[] = [
    `# ForgeDoc elements (${summaries.length})`,
    '',
    'One line each. `forgedoc info <element>` for attributes, parts and an example.',
  ];

  for (const entry of CATEGORIES) {
    const inCategory = summaries.filter((summary) => summary.category === entry.title);
    if (inCategory.length === 0) continue;

    lines.push('', `## ${entry.title}`, `_${entry.blurb}_`, '');
    for (const summary of inCategory) {
      lines.push(`- ${elementLine(summary)}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function elementLine(summary: ElementSummary): string {
  const flags: string[] = [];
  if (summary.generated) flags.push('generated — never write it');
  if (summary.inline) flags.push('inline');
  if (summary.onlyInside) {
    flags.push(`only inside ${summary.onlyInside.map((tag) => `<${tag}>`).join(' or ')}`);
  }
  if (summary.requiresChild) {
    flags.push(`needs ${summary.requiresChild.map((tag) => `<${tag}>`).join(' + ')}`);
  }

  const required =
    summary.required.length > 0
      ? ` — requires ${summary.required.map((name) => `\`${name}\``).join(', ')}`
      : '';
  const suffix = flags.length > 0 ? ` _(${flags.join('; ')})_` : '';

  return `\`<${summary.tag}>\`${required} · ${summary.summary}${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// forgedoc info
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementDetail extends ElementSummary {
  readonly attributes: readonly {
    readonly name: string;
    readonly values: string;
    readonly required: boolean;
    readonly doc: string;
  }[];
  readonly parts: readonly string[];
  readonly states: readonly string[];
  readonly example: string;
  readonly notes: readonly string[];
  readonly related: readonly string[];
}

export function elementDetail(tag: TagName): ElementDetail {
  const definition = spec(tag);
  const documentation = docOf(tag);
  const [summary] = elementSummaries().filter((entry) => entry.tag === tag);

  return {
    ...(summary ?? {
      tag,
      category: CATEGORY_OF[tag] ?? '',
      summary: definition.doc,
      required: requiredAttributes(tag),
      optional: optionalAttributes(tag),
      generated: definition.generated === true,
      inline: definition.inline === true,
    }),
    attributes: Object.entries(definition.attributes).map(([name, attribute]) => ({
      name,
      values: describeKind(attribute.kind),
      required: attribute.required === true,
      doc: attribute.doc,
    })),
    parts: PARTS[tag] ?? [],
    states: STATES[tag] ?? [],
    example: documentation?.example ?? '',
    notes: documentation?.notes ?? [],
    related: documentation?.related ?? [],
  };
}

export function renderInfo(tag: TagName): string {
  const detail = elementDetail(tag);
  const lines: string[] = [`# \`<${tag}>\``, '', detail.summary];

  const banner = infoBanner(detail);
  if (banner.length > 0) lines.push('', ...banner.map((line) => `> ${line}`));

  if (detail.notes.length > 0) {
    lines.push('');
    for (const note of detail.notes) lines.push(`- ${note}`);
  }

  if (detail.attributes.length > 0) {
    lines.push(
      '',
      '## Attributes',
      '',
      '| Attribute | Values | Required | Notes |',
      '| --- | --- | --- | --- |',
      ...detail.attributes.map(
        (attribute) =>
          `| \`${attribute.name}\` | ${escapePipes(attribute.values)} | ${
            attribute.required ? '**yes**' : 'no'
          } | ${escapePipes(attribute.doc)} |`,
      ),
      '',
      'Plus the global attributes — `forgedoc reference` lists them.',
    );
  }

  if (detail.example) {
    lines.push('', '## Example', '', '```html', detail.example, '```');
  }

  if (detail.parts.length > 0) {
    lines.push(
      '',
      '## Styling surface',
      '',
      `**Parts:** ${detail.parts.map((part) => `\`${part}\``).join(', ')}`,
      '',
      `Target one as \`${tag} [data-part="${(detail.parts[0] ?? '').replace('*', '')}"]\`. ` +
        'Only `data-part` selectors are public API.',
    );
  }

  if (detail.states.length > 0) {
    lines.push(
      '',
      `**States:** ${detail.states.map((state) => `\`:state(${state})\``).join(', ')}`,
    );
  }

  if (detail.related.length > 0) {
    lines.push(
      '',
      `**See also:** ${detail.related.map((name) => `\`<${name}>\``).join(', ')}`,
      '',
      `\`forgedoc info ${detail.related[0]}\``,
    );
  }

  return `${lines.join('\n')}\n`;
}

/** The constraints that decide whether markup is even legal, hoisted to the top. */
function infoBanner(detail: ElementDetail): string[] {
  const lines: string[] = [];

  if (detail.generated) {
    lines.push('**Generated by the runtime.** Writing this tag by hand is a build error.');
  }
  if (detail.inline) lines.push('**Inline element** — belongs inside a sentence, not beside one.');
  if (detail.onlyInside) {
    lines.push(
      `**Only valid inside** ${detail.onlyInside
        .map((tag) => `\`<${tag}>\``)
        .join(' or ')}. The validator rejects it anywhere else.`,
    );
  }
  if (detail.requiresChild) {
    lines.push(
      `**Requires a ${detail.requiresChild
        .map((tag) => `\`<${tag}>\``)
        .join(' and a ')} child.** Enforced, not advisory.`,
    );
  }

  return lines;
}

/**
 * Tags whose name is close to `query`, for an unknown-element message.
 *
 * A plain edit distance would rank `doc-tabs` and `doc-table` the same distance
 * from `doc-tab`; substring containment is what an author's near-miss usually
 * looks like, so it is checked first.
 */
export function suggestTags(query: string): readonly TagName[] {
  const needle = normaliseTag(query);
  const contained = TAG_NAMES.filter((tag) => tag.includes(needle) || needle.includes(tag));
  if (contained.length > 0) return contained.slice(0, 5);

  return TAG_NAMES.map((tag) => ({ tag, distance: editDistance(tag, needle) }))
    .filter((entry) => entry.distance <= 3)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 5)
    .map((entry) => entry.tag);
}

/** `page`, `docpage`, `<doc-page>` and `doc-page` all mean the same tag. */
export function normaliseTag(query: string): string {
  const bare = query.trim().toLowerCase().replace(/^</, '').replace(/>$/, '');
  if (isKnownTag(bare)) return bare;

  const prefixed = `doc-${bare.replace(/^doc-?/, '')}`;
  return isKnownTag(prefixed) ? prefixed : bare;
}

// ─────────────────────────────────────────────────────────────────────────────
// forgedoc search
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchHit {
  readonly tag: TagName;
  readonly category: string;
  readonly summary: string;
  /** Why this matched, so an agent can tell a name hit from a prose hit. */
  readonly matched: readonly string[];
  readonly score: number;
}

/**
 * Find a tag by what it does rather than what it is called.
 *
 * why this command exists: an agent knows it wants "a table of contents" or "a
 * way to ask the reader a question" long before it knows the tag is `doc-page
 * toc=` or `doc-choice`. Searching only tag names would answer neither.
 */
export function searchDocs(query: string): readonly SearchHit[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((term) => term.length > 1);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const tag of DOCUMENTED_TAGS) {
    const definition = spec(tag);
    const documentation = docOf(tag);
    const matched = new Set<string>();
    let score = 0;

    const fields: readonly {
      readonly weight: number;
      readonly label: string;
      readonly text: string;
    }[] = [
      { weight: 10, label: 'name', text: tag },
      { weight: 5, label: 'summary', text: definition.doc },
      { weight: 3, label: 'attribute', text: attributeCorpus(tag) },
      { weight: 2, label: 'notes', text: (documentation?.notes ?? []).join(' ') },
      { weight: 1, label: 'example', text: searchableExample(documentation?.example) },
      { weight: 4, label: 'category', text: CATEGORY_OF[tag] ?? '' },
    ];

    for (const term of terms) {
      for (const field of fields) {
        if (!field.text.toLowerCase().includes(term)) continue;
        score += field.weight;
        matched.add(field.label);
      }
    }

    if (score === 0) continue;
    hits.push({
      tag,
      category: CATEGORY_OF[tag] ?? '',
      summary: definition.doc,
      matched: [...matched],
      score,
    });
  }

  return hits.sort((left, right) => right.score - left.score || left.tag.localeCompare(right.tag));
}

/**
 * An example with its URLs removed.
 *
 * why: every `href` in an example carries the substring `http`, so a search for
 * "http endpoint" otherwise returns `doc-term` and `doc-badge` — matched on a
 * placeholder domain that has nothing to do with the question.
 */
function searchableExample(example: string | undefined): string {
  return (example ?? '').replace(/https?:\/\/\S+/g, '');
}

function attributeCorpus(tag: TagName): string {
  return Object.entries(spec(tag).attributes)
    .map(([name, definition]) => {
      const values = definition.kind.type === 'enum' ? definition.kind.values.join(' ') : '';
      return `${name} ${values} ${definition.doc}`;
    })
    .join(' ');
}

export function renderSearch(query: string): string {
  const hits = searchDocs(query);
  if (hits.length === 0) {
    return (
      `Nothing matches "${query}".\n\n` +
      'Try a plainer word — search covers tag names, summaries, attribute names,\n' +
      'enum values, notes and examples. `forgedoc elements` lists everything.\n'
    );
  }

  const lines = [`# ${hits.length} match${hits.length === 1 ? '' : 'es'} for "${query}"`, ''];
  for (const hit of hits) {
    lines.push(
      `- \`<${hit.tag}>\` · ${hit.summary}`,
      `  ${hit.category} · matched ${hit.matched.join(', ')} · \`forgedoc info ${hit.tag}\``,
    );
  }

  return `${lines.join('\n')}\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// forgedoc cheatsheet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The whole vocabulary on one page.
 *
 * MUST stay within one printed page — `tests/node/cheatsheet.test.ts` enforces
 * it. That budget is the forcing function on the vocabulary itself: if the
 * generated sheet no longer fits, the vocabulary has grown too far and something
 * must merge. Compressing the rendering to dodge the limit defeats the point.
 *
 * Child tags are folded into their parent's row (`doc-chips › doc-chip`) because
 * an author never reaches for one without the other, and two rows would spend
 * the budget saying so twice.
 */
export function renderCheatsheet(): string {
  const lines: string[] = [
    '# ForgeDoc cheatsheet',
    '',
    'Write **semantic markup only**. A prebuilt runtime supplies styling, layout, interactivity, persistence and feedback collection. Use whichever form makes an idea clearest — text, an element, or your own `doc-custom` block. Name the file `PLAN_<name>.html` for a plan, `DOC_<name>.html` for a document.',
    '',
    '```html',
    `${PLACEHOLDERS.css}   <!-- in <head> -->`,
    '<doc-page doc-id="demo" density="comfortable" accent="teal">',
    '  <doc-header kicker="Plan · Demo">Title<p slot="lede">Lede.</p></doc-header>',
    '  <doc-section title="Overview"><p>Prose.</p></doc-section>',
    '</doc-page>',
    `${PLACEHOLDERS.js}    <!-- last line of <body> -->`,
    '```',
    '',
    'Build in place `forgedoc build <file.html>` — one file, rebuilt on every revision · offline `--offline` · keep versions `--history` · check `forgedoc validate <file.html> --format=json` · detail `forgedoc info <element>` · find one `forgedoc search <words>`.',
  ];

  for (const group of CHEATSHEET_GROUPS) {
    const tags = CATEGORIES.filter((category) => group.merges.includes(category.title)).flatMap(
      (category) => category.tags,
    );
    const rows = cheatsheetRows(tags);
    if (rows.length === 0) continue;

    lines.push('', `## ${group.title}`, '', '| Tag | Attributes |', '| --- | --- |', ...rows);
  }

  lines.push(
    '',
    '## Rules',
    '',
    ...NEVER_WRITE.map((rule) => `- Never write ${rule}`),
    `- Already styled, so there is no tag for them: ${PLAIN_HTML.map((tag) => `\`<${tag}>\``).join(' ')}. \`lang\` allowlist: ${CODE_LANGUAGES.join(' ')}.`,
    '- Override in this order: preset attribute (`<doc-page density="compact">`), then **token** (`--doc-accent-600`), then **raw CSS** (`[data-part="title"]`, no `!important` needed).',
  );

  return `${lines.join('\n')}\n`;
}

/**
 * Category tags as cheatsheet rows, with child-only tags folded into their
 * parent. A child whose parent is in another category keeps its own row.
 */
function cheatsheetRows(tags: readonly TagName[]): string[] {
  const rows: string[] = [];
  const folded = new Set<TagName>();

  for (const tag of tags) {
    if (folded.has(tag)) continue;

    // The first entry of `onlyInside` is the primary parent: `doc-param` is
    // valid inside both `doc-params` and `doc-endpoint`, but it is the params
    // table it belongs to, and the endpoint reaches it through an attribute.
    const children = tags.filter((candidate) => spec(candidate).onlyInside?.[0] === tag);
    for (const child of children) folded.add(child);

    // One level further down, too: `doc-walkthrough › doc-actor + doc-scene ›
    // doc-move + doc-change`. A grandchild is no more reachable without its
    // parent than a child is, and its own row would spend two lines saying so.
    const grandchildren = tags.filter((candidate) =>
      children.includes(spec(candidate).onlyInside?.[0] as TagName),
    );
    for (const grandchild of grandchildren) folded.add(grandchild);

    const label = familyLabel(tag, children, grandchildren);
    const cells = [
      attributeLine(tag),
      ...children.map((child) => childCell(child)),
      ...grandchildren.map((grandchild) => childCell(grandchild)),
    ]
      .filter((cell) => cell.length > 0)
      .join(' — ');

    rows.push(`| ${label} | ${escapePipes(cells) || contentHint(tag)} |`);
  }

  return rows;
}

/**
 * `doc-blocker › doc-blocks + doc-why + doc-action`: one `›` per level of
 * nesting, `+` between siblings, because a chain of `›` would claim siblings
 * nest inside each other.
 */
function familyLabel(
  tag: TagName,
  children: readonly TagName[],
  grandchildren: readonly TagName[],
): string {
  const quote = (names: readonly TagName[]): string =>
    names.map((name) => `\`${name}\``).join(' + ');
  return [[tag], children, grandchildren]
    .filter((level) => level.length > 0)
    .map(quote)
    .join(' › ');
}

function childCell(child: TagName): string {
  const line = attributeLine(child);
  return line ? `${child.replace(/^doc-/, '')}: ${line}` : '';
}

/** What to put in the body of a tag that has no attributes to describe. */
function contentHint(tag: TagName): string {
  const definition = spec(tag);
  if (definition.generated) return 'generated — never write it';
  if (definition.requiresChild) {
    return `wraps ${definition.requiresChild.map((child) => `\`${child}\``).join(' + ')}`;
  }
  return 'no attributes';
}

// ─────────────────────────────────────────────────────────────────────────────
// forgedoc reference
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything, in markdown. Also written to `docs/REFERENCE.md` by
 * `npm run docs:reference`, so the two are the same bytes by construction.
 */
export function renderReference(): string {
  const sections: string[] = [
    '# ForgeDoc reference',
    '',
    'The complete per-component API. `forgedoc cheatsheet` is the one-page version',
    'to keep open while writing; `forgedoc info <element>` is a single entry.',
  ];

  for (const guide of GUIDE) {
    sections.push('', `## ${guide.title}`, '', guide.body);
  }

  sections.push('', renderGlobalAttributes());

  for (const category of CATEGORIES) {
    sections.push('', `## ${category.title}`, '', `_${category.blurb}_`);
    for (const tag of category.tags) sections.push('', renderReferenceEntry(tag));
  }

  sections.push('', renderLanguages());

  return `${sections.join('\n')}\n`;
}

function renderReferenceEntry(tag: TagName): string {
  const definition = spec(tag);
  const documentation = docOf(tag);
  const lines = [`### \`<${tag}>\``, '', definition.doc];

  const attributes = Object.entries(definition.attributes);
  if (attributes.length > 0) {
    lines.push(
      '',
      '| Attribute | Values | Required | Notes |',
      DELIMITER(4),
      ...attributes.map(
        ([name, attribute]: [string, AttributeSpec]) =>
          `| \`${name}\` | ${escapePipes(describeKind(attribute.kind))} | ${
            attribute.required ? '**yes**' : 'no'
          } | ${escapePipes(attribute.doc)} |`,
      ),
    );
  }

  for (const note of documentation?.notes ?? []) lines.push('', `- ${note}`);

  if (documentation?.example) {
    lines.push('', '```html', documentation.example, '```');
  }

  const parts = PARTS[tag] ?? [];
  if (parts.length > 0) {
    lines.push('', `- **Parts:** ${parts.map((part) => `\`${part}\``).join(', ')}`);
  }

  const states = STATES[tag] ?? [];
  if (states.length > 0) {
    lines.push('', `- **States:** ${states.map((state) => `\`:${state}\``).join(', ')}`);
  }

  if (definition.onlyInside) {
    lines.push(
      '',
      `- **Only valid inside:** ${definition.onlyInside.map((parent) => `\`<${parent}>\``).join(', ')}`,
    );
  }

  if (definition.requiresChild) {
    lines.push(
      '',
      `- **Requires child:** ${definition.requiresChild.map((child) => `\`<${child}>\``).join(', ')}`,
    );
  }

  if (definition.generated) lines.push('', '- **Generated by the runtime.**');
  if (definition.inline) lines.push('', '- **Inline element.**');

  if (documentation?.related?.length) {
    lines.push(
      '',
      `- **See also:** ${documentation.related.map((name) => `\`<${name}>\``).join(', ')}`,
    );
  }

  return lines.join('\n');
}

function renderGlobalAttributes(): string {
  const lines = [
    '## Global attributes',
    '',
    'Accepted on every `doc-*` tag.',
    '',
    '| Attribute | Values | Notes |',
    DELIMITER(3),
  ];

  for (const [name, definition] of Object.entries(GLOBAL_ATTRIBUTES)) {
    lines.push(
      `| \`${name}\` | ${escapePipes(describeKind(definition.kind))} | ${escapePipes(definition.doc)} |`,
    );
  }

  return lines.join('\n');
}

function renderLanguages(): string {
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

  for (const language of CODE_LANGUAGES) lines.push(`| \`${language}\` | Supported |`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON payloads
// ─────────────────────────────────────────────────────────────────────────────

export function elementsJson(category?: string): unknown {
  return {
    categories: CATEGORIES.map((entry) => ({ title: entry.title, blurb: entry.blurb })),
    elements: elementSummaries(category),
  };
}

export function globalAttributesJson(): unknown {
  return Object.entries(GLOBAL_ATTRIBUTES).map(([name, definition]) => ({
    name,
    values: describeKind(definition.kind),
    doc: definition.doc,
  }));
}

/** Resolve `tag` + `attribute` the way the validator does, for a JSON consumer. */
export function attributeJson(tag: TagName, attribute: string): unknown {
  const definition = attributeSpec(tag, attribute);
  if (!definition) return null;
  return {
    name: attribute,
    values: describeKind(definition.kind),
    required: definition.required === true,
    doc: definition.doc,
    global: !(attribute in spec(tag).attributes),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A table delimiter row in the one shape a markdown formatter leaves alone. */
const DELIMITER = (columns: number): string => `| ${Array(columns).fill('---').join(' | ')} |`;

const escapePipes = (text: string): string => text.replace(/\|/g, '\\|');

/** Levenshtein, iterative and bounded by the shorter string. */
function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const substitution = (previous[j - 1] ?? 0) + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(substitution, (previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1);
    }
    previous = current;
  }

  return previous[right.length] ?? Math.max(left.length, right.length);
}
