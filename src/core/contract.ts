/**
 * The markup contract: every tag the authoring agent may write, every attribute
 * it may carry, and the enumerated values those attributes accept.
 *
 * This is the single source of truth for `tools/validate.ts` and for the
 * runtime's registration list. It is deliberately plain data with **no DOM
 * reference of any kind**, because the Node validator MUST NOT import the
 * browser runtime (§11.2) and this module sits on both sides of that line.
 */

/** How a validator should check an attribute's value. */
export type AttributeKind =
  | { readonly type: 'string' }
  /** Present-or-absent. A value is allowed but ignored (`open`, `open=""`). */
  | { readonly type: 'boolean' }
  | { readonly type: 'integer' }
  /** Lowercase slug, used for ids and storage namespaces. */
  | { readonly type: 'slug' }
  | { readonly type: 'url' }
  /** Free-form but non-empty, e.g. line ranges like `3-5,9`. */
  | { readonly type: 'token' }
  | { readonly type: 'enum'; readonly values: readonly string[] };

export interface AttributeSpec {
  readonly kind: AttributeKind;
  readonly required?: boolean;
  /** One-line description, reused verbatim by `skills/better-plan/REFERENCE.md`. */
  readonly doc: string;
}

export interface TagSpec {
  /** One-line description, reused verbatim by `skills/better-plan/REFERENCE.md`. */
  readonly doc: string;
  readonly attributes: Readonly<Record<string, AttributeSpec>>;
  /** Created by the runtime. The validator errors if an author writes it (§8.1). */
  readonly generated?: boolean;
  /** Rendered inline rather than as a block (§7.5). */
  readonly inline?: boolean;
  /** Tags this element is only ever valid inside. */
  readonly onlyInside?: readonly string[];
  /** Descendant tags that must be present. */
  readonly requiresChild?: readonly string[];
}

/**
 * Attributes accepted on every `plan-*` tag.
 *
 * why: `id` is an author override for a derived id, `class` and `style` are
 * escape hatches the validator only *warns* about, and `hidden`/`lang`/`dir`
 * are ordinary HTML the agent may legitimately need.
 */
export const GLOBAL_ATTRIBUTES: Readonly<Record<string, AttributeSpec>> = {
  id: {
    kind: { type: 'slug' },
    doc: 'Override the derived id. Prefer letting the runtime derive it.',
  },
  class: { kind: { type: 'string' }, doc: 'Author styling hook. Not used by the library.' },
  style: { kind: { type: 'string' }, doc: 'Inline token override, e.g. `--plan-space-unit: 3px`.' },
  hidden: { kind: { type: 'boolean' }, doc: 'Standard HTML `hidden`.' },
  lang: { kind: { type: 'string' }, doc: 'Standard HTML `lang`.' },
  dir: { kind: { type: 'enum', values: ['ltr', 'rtl', 'auto'] }, doc: 'Standard HTML `dir`.' },
};

/**
 * Prism languages compiled into the bundle.
 *
 * MUST (§8.6): a `lang` outside this list is a build **error**. Silent fallback
 * to plain text is exactly the invisible drift this library exists to remove.
 * Extending the list is a one-line change here plus an import in
 * `src/vendor/prism-languages.ts`, then a rebuild.
 */
export const CODE_LANGUAGES = [
  'ts',
  'js',
  'tsx',
  'jsx',
  'html',
  'css',
  'json',
  'bash',
  'sh',
  'sql',
  'rust',
  'python',
  'yaml',
  'toml',
  'diff',
  'http',
  'text',
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

/** Preset axes on `plan-doc` (§6.3). Four orthogonal axes, never bundled into one attribute. */
export const PRESET_AXES = {
  density: ['compact', 'comfortable', 'spacious'],
  scale: ['sm', 'md', 'lg'],
  accent: ['teal', 'indigo', 'slate', 'plum', 'amber'],
  measure: ['narrow', 'default', 'wide'],
  code: ['auto', 'light', 'dark'],
} as const;

const presetAttribute = (axis: keyof typeof PRESET_AXES, doc: string): AttributeSpec => ({
  kind: { type: 'enum', values: PRESET_AXES[axis] },
  doc,
});

/**
 * Every tag in the vocabulary: 22 authored, 9 child-only, 1 generated (§8).
 *
 * Adding a tag here is not enough — it also needs a file in `src/components/`
 * named exactly after it, an entry in `src/index.ts`, a stylesheet in
 * `src/styles/components/`, and a use in `tests/fixtures/kitchen-sink.html`
 * (CI fails otherwise, §13.3).
 */
export const TAGS = {
  // ── Shell ──────────────────────────────────────────────────────────────────
  'plan-doc': {
    doc: 'The root, and the only authored root. Owns the store, the layout column, the TOC and the bucket.',
    attributes: {
      'plan-id': {
        kind: { type: 'slug' },
        required: true,
        doc: 'Storage namespace. Required — see §9.3, `file://` shares one localStorage bucket.',
      },
      density: presetAttribute('density', 'Spacing unit, line-height and component padding.'),
      scale: presetAttribute('scale', 'Type scale base size and ratio.'),
      accent: presetAttribute('accent', 'Accent ramp and derived tints.'),
      measure: presetAttribute('measure', 'Reading column width: 720 / 1200 / 1600px.'),
      code: presetAttribute('code', 'Prism theme: follow the document, or force light/dark.'),
      toc: {
        kind: { type: 'enum', values: ['open', 'closed', 'docked', 'off'] },
        doc: 'Contents panel: floating open, collapsed, docked beside the content, or absent. Defaults to floating and collapsed; the reader can change it and the choice is remembered.',
      },
      numbering: {
        kind: { type: 'enum', values: ['counter', 'text'] },
        doc: 'Section numbers as CSS counters (default, cheap) or real selectable text nodes.',
      },
    },
  },

  'plan-header': {
    doc: 'Document title block. Heading text is the default content; an optional `<p slot="lede">` follows.',
    attributes: {
      kicker: { kind: { type: 'string' }, doc: 'Small-caps eyebrow line above the title.' },
    },
  },

  'plan-section': {
    doc: 'A numbered section. Nests to depth 3. Number, id and TOC entry are all derived.',
    attributes: {
      title: {
        kind: { type: 'string' },
        required: true,
        doc: 'Heading text. Also the source of the derived id.',
      },
    },
  },

  'plan-toc': {
    doc: 'Generated table of contents. Never write this tag — the runtime creates it.',
    generated: true,
    attributes: {},
  },

  // ── Meta ───────────────────────────────────────────────────────────────────
  'plan-chips': {
    doc: 'The pill row under the lede: locked decisions and reader instructions.',
    attributes: {},
  },

  'plan-chip': {
    doc: 'One pill. Carries real meaning, not decoration.',
    onlyInside: ['plan-chips'],
    attributes: {
      kind: {
        kind: { type: 'enum', values: ['confirmed', 'info', 'action', 'pending'] },
        doc: 'Colour and icon. Defaults to `info`.',
      },
    },
  },

  // ── Prose and callouts ─────────────────────────────────────────────────────
  'plan-note': {
    doc: 'Coloured callout.',
    attributes: {
      kind: {
        kind: { type: 'enum', values: ['info', 'tip', 'warn', 'danger', 'success'] },
        doc: 'Colour ramp and icon. Defaults to `info`.',
      },
      title: { kind: { type: 'string' }, doc: 'Optional bold lead line.' },
    },
  },

  'plan-blocker': {
    doc: 'A roadblock with an enforced shape: what it blocks, why, and the action that resolves it.',
    requiresChild: ['plan-blocks', 'plan-action'],
    attributes: {
      severity: {
        kind: { type: 'enum', values: ['low', 'medium', 'high'] },
        doc: 'Drives colour. Defaults to `medium`.',
      },
      title: {
        kind: { type: 'string' },
        required: true,
        doc: 'One-line statement of the roadblock.',
      },
    },
  },

  'plan-blocks': {
    doc: 'What the roadblock breaks. Required inside `plan-blocker`.',
    onlyInside: ['plan-blocker'],
    attributes: {},
  },

  'plan-why': {
    doc: 'Why the roadblock happens. Optional.',
    onlyInside: ['plan-blocker'],
    attributes: {},
  },

  'plan-action': {
    doc: 'The action that resolves the roadblock. Required — a roadblock without a resolution is the failure this library prevents.',
    onlyInside: ['plan-blocker'],
    attributes: {},
  },

  'plan-list': {
    doc: 'A marked list. Children are plain `<li>`.',
    attributes: {
      marker: {
        kind: { type: 'enum', values: ['check', 'cross', 'arrow', 'dot', 'number'] },
        doc: 'Bullet glyph. Defaults to `dot`.',
      },
      title: { kind: { type: 'string' }, doc: 'Column heading, used inside `plan-compare`.' },
      kind: {
        kind: { type: 'enum', values: ['positive', 'negative', 'neutral'] },
        doc: 'Tone of the column inside `plan-compare`. Defaults to `neutral`.',
      },
    },
  },

  'plan-term': {
    doc: 'Inline technical term, hyperlinked. First mention is styled differently from repeats.',
    inline: true,
    attributes: {
      href: { kind: { type: 'url' }, required: true, doc: 'Where the term is defined.' },
    },
  },

  'plan-ref': {
    doc: 'Inline cross-reference. Resolves to the live number at mount, so nothing goes stale when sections shift.',
    inline: true,
    attributes: {
      to: { kind: { type: 'slug' }, required: true, doc: 'Id of a section, stage or question.' },
    },
  },

  'plan-quote': {
    doc: 'Pull quote with a distinct typographic role.',
    attributes: {
      cite: { kind: { type: 'string' }, doc: 'Attribution line.' },
    },
  },

  'plan-table': {
    doc: 'Wraps a plain `<table>`. Header styling, first-column emphasis, tabular numerals.',
    requiresChild: ['table'],
    attributes: {
      size: {
        kind: { type: 'enum', values: ['sm', 'md'] },
        doc: 'Cell padding and type size. Defaults to `md`.',
      },
      stack: {
        kind: { type: 'enum', values: ['auto', 'never'] },
        doc: 'Below 1050px, `auto` converts rows into stacked label/value cards. Defaults to `auto`.',
      },
    },
  },

  // ── Interactive ────────────────────────────────────────────────────────────
  'plan-choice': {
    doc: 'A question with lettered options. Letter keys, the Other option, the note field and ARIA are all derived.',
    requiresChild: ['plan-option'],
    attributes: {
      mode: {
        kind: { type: 'enum', values: ['single', 'multi'] },
        doc: 'One answer or several. Defaults to `single`.',
      },
      question: {
        kind: { type: 'string' },
        required: true,
        doc: 'The question text. Also the source of the derived id.',
      },
    },
  },

  'plan-option': {
    doc: 'One answer. Label text is the default content; an optional `<p slot="desc">` follows.',
    onlyInside: ['plan-choice'],
    attributes: {
      recommended: {
        kind: { type: 'boolean' },
        doc: 'Adds a "recommended" badge. Use this instead of `disabled`.',
      },
      value: {
        kind: { type: 'string' },
        doc: 'Override the stored value. Defaults to the derived letter key.',
      },
    },
  },

  'plan-collapse': {
    doc: 'Generic disclosure, built on `<details>`/`<summary>`.',
    attributes: {
      title: { kind: { type: 'string' }, required: true, doc: 'Summary text.' },
      open: { kind: { type: 'boolean' }, doc: 'Start expanded.' },
      sticky: { kind: { type: 'boolean' }, doc: 'Persist the reader’s open/closed choice.' },
    },
  },

  'plan-tabs': {
    doc: 'Tab strip. Arrow-key navigation and roving tabindex are built in; flattens in print.',
    requiresChild: ['plan-tab'],
    attributes: {},
  },

  'plan-tab': {
    doc: 'One tab panel.',
    onlyInside: ['plan-tabs'],
    attributes: {
      label: { kind: { type: 'string' }, required: true, doc: 'Tab strip label.' },
      active: { kind: { type: 'boolean' }, doc: 'Initially selected tab.' },
    },
  },

  'plan-checklist': {
    doc: 'Persistent reader-facing ticks. Children are plain `<li>`.',
    attributes: {},
  },

  // ── Structure ──────────────────────────────────────────────────────────────
  'plan-flow': {
    doc: 'A horizontal chain of steps. Not a Mermaid job — it must sit inline at reading width.',
    requiresChild: ['plan-flow-node'],
    attributes: {},
  },

  'plan-flow-node': {
    doc: 'One step in a `plan-flow`. Child text is the subtitle.',
    onlyInside: ['plan-flow'],
    attributes: {
      title: { kind: { type: 'string' }, required: true, doc: 'Step name.' },
      active: { kind: { type: 'boolean' }, doc: 'The emphasised dark node.' },
    },
  },

  'plan-roadmap': {
    doc: 'A numbered sequence of collapsible stages with a current-position marker.',
    requiresChild: ['plan-stage'],
    attributes: {
      start: { kind: { type: 'integer' }, doc: 'First stage number. Defaults to 0.' },
    },
  },

  'plan-stage': {
    doc: 'One stage. Number badge, rail and current-stage treatment are all derived.',
    onlyInside: ['plan-roadmap'],
    attributes: {
      title: { kind: { type: 'string' }, required: true, doc: 'Stage name.' },
      subtitle: { kind: { type: 'string' }, doc: 'Secondary line beside the title.' },
      current: { kind: { type: 'boolean' }, doc: 'Marks the stage as the current position.' },
      open: { kind: { type: 'boolean' }, doc: 'Start expanded. `current` implies this.' },
    },
  },

  // ── Content ────────────────────────────────────────────────────────────────
  'plan-code': {
    doc: 'A syntax-highlighted code block.',
    attributes: {
      lang: {
        kind: { type: 'enum', values: CODE_LANGUAGES },
        required: true,
        doc: 'Language. Outside the allowlist is a build error, never a silent fallback.',
      },
      title: { kind: { type: 'string' }, doc: 'Filename or caption in the block header.' },
      wrap: { kind: { type: 'boolean' }, doc: 'Soft-wrap long lines instead of scrolling.' },
      highlight: { kind: { type: 'token' }, doc: 'Emphasised line ranges, e.g. `3-5,9`.' },
    },
  },

  'plan-diff': {
    doc: 'A unified diff with +/- gutters and aligned line numbers.',
    attributes: {
      lang: {
        kind: { type: 'enum', values: CODE_LANGUAGES },
        doc: 'Language of the diffed content.',
      },
      filename: { kind: { type: 'string' }, doc: 'Path shown in the block header.' },
    },
  },

  'plan-figure': {
    doc: 'One framed box for a diagram, image, Mermaid source or isolated HTML mock.',
    attributes: {
      type: {
        kind: { type: 'enum', values: ['svg', 'image', 'mermaid', 'html'] },
        doc: 'What the child content is. Defaults to `svg`.',
      },
      src: { kind: { type: 'url' }, doc: 'Image source, for `type="image"`.' },
      alt: { kind: { type: 'string' }, doc: 'Alternative text, for `type="image"`.' },
      caption: {
        kind: { type: 'string' },
        doc: 'Plain caption. Use `<plan-caption>` for a rich one.',
      },
    },
  },

  'plan-caption': {
    doc: 'Rich caption for a `plan-figure`, as an alternative to the `caption` attribute.',
    onlyInside: ['plan-figure'],
    attributes: {},
  },

  'plan-tree': {
    doc: 'A directory tree drawn from indented plain text.',
    attributes: {
      root: { kind: { type: 'string' }, doc: 'Label for the root node.' },
    },
  },

  'plan-compare': {
    doc: 'A two-column comparison panel. Children are `plan-list` blocks with a `title`.',
    requiresChild: ['plan-list'],
    attributes: {
      columns: { kind: { type: 'integer' }, doc: 'Column count. Defaults to 2.' },
    },
  },
} as const satisfies Record<string, TagSpec>;

export type TagName = keyof typeof TAGS;

/** Every tag name in the vocabulary, including generated and child-only tags. */
export const TAG_NAMES = Object.keys(TAGS) as TagName[];

/** Tags rendered inline rather than as blocks (§7.5). */
export const INLINE_TAG_NAMES: readonly string[] = TAG_NAMES.filter(
  (name) => (TAGS[name] as TagSpec).inline === true,
);

/** True when `name` is part of the vocabulary. Narrows for callers. */
export function isKnownTag(name: string): name is TagName {
  return Object.hasOwn(TAGS, name);
}

/** Look up an attribute spec, falling back to the global attribute table. */
export function attributeSpec(tag: TagName, attribute: string): AttributeSpec | undefined {
  const own = (TAGS[tag] as TagSpec).attributes[attribute];
  if (own) return own;
  return GLOBAL_ATTRIBUTES[attribute];
}
