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
  /** One-line description, reused verbatim by `docs/REFERENCE.md`. */
  readonly doc: string;
}

export interface TagSpec {
  /** One-line description, reused verbatim by `docs/REFERENCE.md`. */
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
 * Attributes accepted on every `doc-*` tag.
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
  style: { kind: { type: 'string' }, doc: 'Inline token override, e.g. `--doc-space-unit: 3px`.' },
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

/** Preset axes on `doc-page` (§6.3). Four orthogonal axes, never bundled into one attribute. */
export const PRESET_AXES = {
  density: ['compact', 'comfortable', 'spacious'],
  scale: ['sm', 'md', 'lg'],
  accent: ['teal', 'indigo', 'slate', 'plum', 'amber'],
  measure: ['narrow', 'default', 'wide'],
  code: ['auto', 'light', 'dark'],
} as const;

/**
 * The master tag dictionary. Every component in `src/components/` must correspond
 * to an entry here, and the test suite verifies that bidirectional invariant.
 */
export const TAGS = {
  // ── Shell ──────────────────────────────────────────────────────────────────
  'doc-page': {
    doc: 'The root, and the only authored root. Owns the store, the layout column, the TOC and the bucket.',
    attributes: {
      'doc-id': {
        kind: { type: 'slug' },
        required: true,
        doc: 'Storage namespace. Required — see §9.3, `file://` shares one localStorage bucket.',
      },
      density: {
        kind: { type: 'enum', values: PRESET_AXES.density },
        doc: 'Spacing unit, line-height and component padding. Defaults to `comfortable`.',
      },
      scale: {
        kind: { type: 'enum', values: PRESET_AXES.scale },
        doc: 'Type scale base size and ratio. Defaults to `md`.',
      },
      accent: {
        kind: { type: 'enum', values: PRESET_AXES.accent },
        doc: 'Accent ramp and derived tints. Defaults to `teal`.',
      },
      measure: {
        kind: { type: 'enum', values: PRESET_AXES.measure },
        doc: 'Reading column width: 720 / 1200 / 1600px. Defaults to `default`.',
      },
      code: {
        kind: { type: 'enum', values: PRESET_AXES.code },
        doc: 'Prism theme: follow the document, or force light/dark. Defaults to `auto`.',
      },
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

  'doc-header': {
    doc: 'Document title block. Heading text is the default content; an optional `<p slot="lede">` follows.',
    attributes: {
      kicker: { kind: { type: 'string' }, doc: 'Small-caps eyebrow line above the title.' },
    },
  },

  'doc-section': {
    doc: 'Structural section. Derives its anchor id and heading from `title`. Nestable up to 3 deep.',
    attributes: {
      title: {
        kind: { type: 'string' },
        required: true,
        doc: 'Section heading text. Derives the section id for TOC and deep-linking.',
      },
    },
  },

  'doc-toc': {
    doc: 'Table of contents navigation panel.',
    generated: true,
    attributes: {},
  },

  // ── Meta & Ownership ──────────────────────────────────────────────────────
  'doc-chips': {
    doc: 'A flex row of meta pills (tags, versions, reviewers).',
    attributes: {},
  },

  'doc-chip': {
    doc: 'A single status / metadata pill.',
    onlyInside: ['doc-chips'],
    attributes: {
      kind: {
        kind: { type: 'enum', values: ['confirmed', 'info', 'action', 'pending'] },
        doc: 'Locked decision, plain context, an instruction to the reader, or something still open. Defaults to `info`.',
      },
    },
  },

  'doc-owners': {
    doc: 'Document authors, owners, and DRI sign-off status block.',
    attributes: {},
  },

  'doc-owner': {
    doc: 'Single owner or reviewer entry with avatar, name, role, and approval status.',
    onlyInside: ['doc-owners'],
    attributes: {
      name: { kind: { type: 'string' }, required: true, doc: 'Name of the person or team.' },
      role: { kind: { type: 'string' }, doc: 'DRI, Reviewer, Lead, etc. Defaults to `Owner`.' },
      avatar: {
        kind: { type: 'string' },
        doc: 'Glyph or initials for the avatar. Defaults to the first letter of `name`.',
      },
      status: {
        kind: {
          type: 'enum',
          values: ['approved', 'pending', 'reviewing', 'rejected'],
        },
        doc: 'Sign-off status. Defaults to `reviewing`.',
      },
    },
  },

  // ── Architecture & API ────────────────────────────────────────────────────
  'doc-decision': {
    doc: 'Architecture Decision Record (ADR) / RFC card with structured header and rationale body.',
    attributes: {
      id: { kind: { type: 'string' }, doc: 'ADR identifier (e.g. ADR-001).' },
      title: { kind: { type: 'string' }, required: true, doc: 'Decision title / summary.' },
      status: {
        kind: {
          type: 'enum',
          values: ['accepted', 'proposed', 'rejected', 'deprecated', 'superseded'],
        },
        doc: 'Status of the architectural decision.',
      },
      date: { kind: { type: 'string' }, doc: 'ISO date string or human date.' },
    },
  },

  'doc-endpoint': {
    doc: 'Compact HTTP API operation button that opens a generated OpenAPI-style detail drawer.',
    attributes: {
      method: {
        kind: {
          type: 'enum',
          values: ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'],
        },
        required: true,
        doc: 'HTTP method.',
      },
      path: {
        kind: { type: 'string' },
        required: true,
        doc: 'API route URL path (e.g. `/api/v1/users/{id}`).',
      },
      summary: {
        kind: { type: 'string' },
        doc: 'Short operation label shown in the endpoint row and drawer heading.',
      },
      description: {
        kind: { type: 'string' },
        doc: 'Longer operation explanation shown only in the generated drawer.',
      },
      auth: {
        kind: {
          type: 'enum',
          values: ['bearer', 'basic', 'api-key', 'session', 'none'],
        },
        doc: 'Authentication requirement.',
      },
      headers: {
        kind: { type: 'string' },
        doc: 'Semicolon or comma-separated list of request headers (e.g. `Content-Type: application/json; Authorization: Bearer ...`).',
      },
      params: {
        kind: { type: 'string' },
        doc: 'Compact semicolon-separated parameters: `name:in:type:required|optional:description`.',
      },
      request: {
        kind: { type: 'string' },
        doc: 'Optional request example rendered as code in the drawer.',
      },
      status: {
        kind: { type: 'string' },
        doc: 'Expected HTTP response status code and description (e.g. `200 OK`, `201 Created`).',
      },
      response: {
        kind: { type: 'string' },
        doc: 'Optional response example rendered as code in the drawer.',
      },
    },
  },

  'doc-params': {
    doc: 'Parameter / argument specification table for APIs, CLI options, and function signatures.',
    attributes: {},
  },

  'doc-param': {
    doc: 'Single parameter item with name, type, requirement badge, default value, and description.',
    onlyInside: ['doc-params', 'doc-endpoint'],
    attributes: {
      name: { kind: { type: 'string' }, required: true, doc: 'Parameter name.' },
      type: {
        kind: { type: 'string' },
        doc: 'Type signature (e.g. `string`, `number`, `boolean`).',
      },
      in: {
        kind: { type: 'enum', values: ['path', 'query', 'header', 'body'] },
        doc: 'Where the API parameter is sent. Defaults to `query`.',
      },
      required: { kind: { type: 'boolean' }, doc: 'Whether the parameter is mandatory.' },
      default: { kind: { type: 'string' }, doc: 'Default value if omitted.' },
    },
  },

  'doc-steps': {
    doc: 'Sequential step-by-step procedure or setup walkthrough list.',
    attributes: {},
  },

  'doc-step': {
    doc: 'A single step in a step-by-step sequence with title, status, and description.',
    onlyInside: ['doc-steps'],
    attributes: {
      title: { kind: { type: 'string' }, required: true, doc: 'Step title.' },
      status: {
        kind: {
          type: 'enum',
          values: ['completed', 'active', 'pending', 'optional'],
        },
        doc: 'Progress status of the step.',
      },
    },
  },

  // ── Metrics & Planning ────────────────────────────────────────────────────
  'doc-stats': {
    doc: 'A metric / KPI card grid layout.',
    attributes: {},
  },

  'doc-stat': {
    doc: 'Single metric / KPI card displaying value, label, trend arrow, and delta difference.',
    onlyInside: ['doc-stats'],
    attributes: {
      label: { kind: { type: 'string' }, required: true, doc: 'Metric label.' },
      value: { kind: { type: 'string' }, required: true, doc: 'Value text or number.' },
      trend: {
        kind: { type: 'enum', values: ['up', 'down', 'flat'] },
        doc: 'Directional indicator arrow.',
      },
      good: { kind: { type: 'boolean' }, doc: 'Whether the trend direction is positive.' },
      tone: {
        kind: { type: 'enum', values: ['good', 'bad', 'neutral'] },
        doc: 'Colour of the delta when `good` does not apply. Defaults to `neutral`.',
      },
      diff: { kind: { type: 'string' }, doc: 'Delta text (e.g. +15%, -2ms).' },
    },
  },

  'doc-timeline': {
    doc: 'Delivery milestone timeline container.',
    attributes: {},
  },

  'doc-milestone': {
    doc: 'A milestone event in a delivery timeline with date, title, owner, and status.',
    onlyInside: ['doc-timeline'],
    attributes: {
      date: { kind: { type: 'string' }, required: true, doc: 'Target date or release milestone.' },
      title: { kind: { type: 'string' }, required: true, doc: 'Milestone title.' },
      status: {
        kind: {
          type: 'enum',
          values: ['completed', 'in-progress', 'planned', 'delayed'],
        },
        doc: 'Status of the milestone.',
      },
      owner: { kind: { type: 'string' }, doc: 'Owner or squad responsible.' },
    },
  },

  'doc-matrix': {
    doc: 'Structured decision or RACI matrix wrapper.',
    attributes: {
      type: {
        kind: {
          type: 'enum',
          values: ['raci', 'risk', 'comparison', 'custom'],
        },
        doc: 'Type of matrix table. Defaults to `comparison`.',
      },
    },
  },

  // ── Prose & Callouts ──────────────────────────────────────────────────────
  'doc-badge': {
    doc: 'Compact status tag / label pill.',
    inline: true,
    attributes: {
      variant: {
        kind: {
          type: 'enum',
          values: ['info', 'success', 'warn', 'danger', 'neutral', 'accent'],
        },
        doc: 'Visual variant of the badge.',
      },
    },
  },

  'doc-note': {
    doc: 'Callout block with icon and tone ramp.',
    attributes: {
      kind: {
        kind: { type: 'enum', values: ['info', 'tip', 'warn', 'danger', 'success'] },
        doc: 'Tone: blue info (default), green tip, amber warn, red danger, green success.',
      },
      title: { kind: { type: 'string' }, doc: 'Optional bold heading on the callout.' },
    },
  },

  'doc-blocker': {
    doc: 'Roadblock banner requiring resolution. Contains `<doc-blocks>`, `<doc-why>` and `<doc-action>`.',
    requiresChild: ['doc-action'],
    attributes: {
      severity: {
        kind: {
          type: 'enum',
          values: ['high', 'medium', 'low'],
        },
        doc: 'Severity: high red (default), medium amber, low gray.',
      },
      title: { kind: { type: 'string' }, required: true, doc: 'Short headline of the blocker.' },
    },
  },

  'doc-blocks': {
    doc: 'The "What it blocks" line of a `<doc-blocker>`.',
    onlyInside: ['doc-blocker'],
    attributes: {},
  },

  'doc-why': {
    doc: 'The "Why it happened" line of a `<doc-blocker>`.',
    onlyInside: ['doc-blocker'],
    attributes: {},
  },

  'doc-action': {
    doc: 'The "What unblocks it" line of a `<doc-blocker>`. Required.',
    onlyInside: ['doc-blocker'],
    attributes: {},
  },

  'doc-list': {
    doc: 'A list with custom markers (check, cross, arrow, dash, bullet, number).',
    attributes: {
      marker: {
        kind: { type: 'enum', values: ['check', 'cross', 'arrow', 'dot', 'number'] },
        doc: 'Glyph or counter for items. Defaults to `dot`; `number` is drawn by a CSS counter.',
      },
      title: { kind: { type: 'string' }, doc: 'Optional heading above the list.' },
      kind: {
        kind: { type: 'enum', values: ['positive', 'negative', 'neutral'] },
        doc: 'Tone of the column inside `doc-compare`. Defaults to `neutral`.',
      },
    },
  },

  'doc-term': {
    doc: 'Inline technical term, hyperlinked. First mention is styled differently from repeats.',
    inline: true,
    attributes: {
      href: { kind: { type: 'url' }, required: true, doc: 'Where the term is defined.' },
    },
  },

  'doc-ref': {
    doc: 'Inline cross-reference. Resolves to the live number at mount, so nothing goes stale when sections shift.',
    inline: true,
    attributes: {
      to: {
        kind: { type: 'string' },
        required: true,
        doc: 'Target section title or id (e.g. `sec-what-we-are-building` or `sec-roadmap`).',
      },
    },
  },

  // ── Interactivity ─────────────────────────────────────────────────────────
  'doc-choice': {
    doc: 'A decision question with mutually-exclusive or multi-select options.',
    requiresChild: ['doc-option'],
    attributes: {
      id: {
        kind: { type: 'slug' },
        doc: 'Stable key in the feedback bucket. Derived from `question` if omitted.',
      },
      question: { kind: { type: 'string' }, required: true, doc: 'Question text.' },
      mode: {
        kind: { type: 'enum', values: ['single', 'multi'] },
        doc: 'Selection mode: radio (default) or checkbox.',
      },
    },
  },

  'doc-option': {
    doc: 'One answer in a `doc-choice`. Option letters (A, B, C) are derived.',
    onlyInside: ['doc-choice'],
    attributes: {
      label: { kind: { type: 'string' }, doc: 'Optional label text.' },
      value: { kind: { type: 'string' }, doc: 'Optional custom value string.' },
      hint: { kind: { type: 'string' }, doc: 'One-line trade-off note beside the label.' },
      recommended: { kind: { type: 'boolean' }, doc: 'Option the agent is recommending.' },
      other: {
        kind: { type: 'boolean' },
        doc: 'Reveals a free-text input when chosen. Only valid on the last option.',
      },
    },
  },

  'doc-rating': {
    doc: 'Interactive rating / scorecard with score options saved directly to feedback bucket.',
    attributes: {
      id: { kind: { type: 'slug' }, doc: 'Stable key in the feedback bucket.' },
      question: { kind: { type: 'string' }, required: true, doc: 'Evaluation question or title.' },
      scale: {
        kind: { type: 'integer' },
        doc: 'Highest score on the scale. Clamped to 3–10; defaults to 5.',
      },
    },
  },

  'doc-carousel': {
    doc: 'Interactive slide viewer / gallery container with non-destructive slide toggling.',
    attributes: {
      title: { kind: { type: 'string' }, doc: 'Optional title banner for the gallery.' },
    },
  },

  'doc-tabs': {
    doc: 'Tabbed panel switch. Contains one or more `<doc-tab label="...">`.',
    requiresChild: ['doc-tab'],
    attributes: {},
  },

  'doc-tab': {
    doc: 'A single tab panel.',
    onlyInside: ['doc-tabs'],
    attributes: {
      label: { kind: { type: 'string' }, required: true, doc: 'Tab button text.' },
      active: { kind: { type: 'boolean' }, doc: 'Set to make this tab the initially visible one.' },
    },
  },

  'doc-checklist': {
    doc: 'Interactive checklist. Items persist check state in the document store.',
    attributes: {},
  },

  // ── Structure & Content ───────────────────────────────────────────────────
  'doc-flow': {
    doc: 'Horizontal sequence flow. Nodes connect with arrows; wrap automatically.',
    requiresChild: ['doc-flow-node'],
    attributes: {},
  },

  'doc-flow-node': {
    doc: 'One step in a `<doc-flow>`.',
    onlyInside: ['doc-flow'],
    attributes: {
      title: { kind: { type: 'string' }, required: true, doc: 'Node label.' },
      active: { kind: { type: 'boolean' }, doc: 'Highlights the current or recommended path.' },
    },
  },

  'doc-roadmap': {
    doc: 'Delivery phases with numbers, subtitles, and expandable content.',
    requiresChild: ['doc-stage'],
    attributes: {
      start: {
        kind: { type: 'integer' },
        doc: 'Number assigned to the first stage (0 or 1). Default 1.',
      },
    },
  },

  'doc-stage': {
    doc: 'One phase in a roadmap. Derives its anchor id and badge number.',
    onlyInside: ['doc-roadmap'],
    attributes: {
      title: { kind: { type: 'string' }, required: true, doc: 'Stage name.' },
      subtitle: { kind: { type: 'string' }, doc: 'One-line status or timing beside the title.' },
      current: {
        kind: { type: 'boolean' },
        doc: 'Highlights the active phase with an accent border.',
      },
      open: { kind: { type: 'boolean' }, doc: 'Expands the stage body on load.' },
    },
  },

  'doc-code': {
    doc: 'Syntax-highlighted code block with line numbers, copy button, and highlight ranges.',
    attributes: {
      lang: {
        kind: { type: 'enum', values: CODE_LANGUAGES },
        required: true,
        doc: 'Language for syntax highlighting. Required.',
      },
      title: { kind: { type: 'string' }, doc: 'Filename or label in the header bar.' },
      highlight: {
        kind: { type: 'string' },
        doc: 'Line numbers or ranges to highlight (e.g. `3`, `5-8`, `3, 5-8`).',
      },
      wrap: {
        kind: { type: 'boolean' },
        doc: 'Soft-wrap long lines instead of scrolling them horizontally.',
      },
    },
  },

  'doc-diff': {
    doc: 'Unified diff viewer with additions and deletions highlighted.',
    attributes: {
      lang: {
        kind: { type: 'enum', values: CODE_LANGUAGES },
        doc: 'Syntax highlighting language for diff lines.',
      },
      filename: { kind: { type: 'string' }, doc: 'File path displayed in the header.' },
    },
  },

  'doc-figure': {
    doc: 'Diagram or illustration container with Mermaid rendering and caption.',
    attributes: {
      type: {
        kind: { type: 'enum', values: ['svg', 'image', 'mermaid', 'html'] },
        doc: 'Figure type. Defaults to `svg`. `html` renders inside a sandboxed `<iframe srcdoc>`.',
      },
      caption: { kind: { type: 'string' }, doc: 'Figure caption beneath the illustration.' },
      src: { kind: { type: 'url' }, doc: 'Image URL for `type="image"`.' },
      alt: { kind: { type: 'string' }, doc: 'Accessible description for screen readers.' },
    },
  },

  'doc-caption': {
    doc: 'Rich figure caption containing formatted prose, links or terms.',
    onlyInside: ['doc-figure'],
    attributes: {},
  },

  'doc-tree': {
    doc: 'Directory tree viewer with ASCII connector lines and folder icons.',
    attributes: {
      root: { kind: { type: 'string' }, doc: 'Root folder name displayed at top of tree.' },
    },
  },

  'doc-table': {
    doc: 'Wraps a plain `<table>`. Adds a scroll port and, below 1050px, stacks rows into label/value cards.',
    attributes: {
      size: {
        kind: { type: 'enum', values: ['sm', 'md'] },
        doc: 'Cell padding and type size. Defaults to `md`.',
      },
      stack: {
        kind: { type: 'enum', values: ['auto', 'never'] },
        doc: 'Whether narrow viewports restack rows as cards (§8.3). Defaults to `auto`.',
      },
    },
  },

  'doc-quote': {
    doc: 'Pull quote with its own typographic role. The quoted text is the default content.',
    attributes: {
      cite: { kind: { type: 'string' }, doc: 'Attribution line beneath the quote.' },
    },
  },

  'doc-collapse': {
    doc: 'Generic disclosure. Use `doc-stage` instead when the sections form a numbered sequence (§8.5).',
    attributes: {
      title: { kind: { type: 'string' }, required: true, doc: 'Summary text on the toggle.' },
      open: { kind: { type: 'boolean' }, doc: 'Starts expanded.' },
      sticky: {
        kind: { type: 'boolean' },
        doc: "Remembers the reader's choice in the store, so it outlives a reload. Without it `open` wins on every load.",
      },
    },
  },

  'doc-compare': {
    doc: 'Side-by-side or column comparison container for options, pros/cons, before/after.',
    attributes: {
      columns: {
        kind: { type: 'enum', values: ['2', '3', '4'] },
        doc: 'Number of comparison columns. Default 2.',
      },
    },
  },
} as const satisfies Record<string, TagSpec>;

/**
 * HTML phrasing content — the tags that belong *inside* a sentence.
 *
 * why a static list rather than a computed `display`: this table is read by the
 * Node validator, which has no DOM at all, and by `nameAuthorContent`, which
 * runs before first paint and must not force a layout to name a child. It is
 * also the more honest test — `<code>` is phrasing content whatever a
 * stylesheet later does to it.
 */
export const PHRASING_TAGS: ReadonlySet<string> = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'button',
  'cite',
  'code',
  'data',
  'dfn',
  'em',
  'i',
  'input',
  'kbd',
  'label',
  'mark',
  'output',
  'q',
  'ruby',
  's',
  'samp',
  'select',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'textarea',
  'time',
  'u',
  'var',
  'wbr',
]);

/**
 * Embedded content — phrasing content that is nonetheless a *thing*, not a word.
 *
 * why it is listed apart: an `<img>` in the middle of a step's sentence is part
 * of that sentence, but the `<svg>` inside a `doc-figure` is the whole point of
 * the figure. Both readings are correct, and only the component knows which one
 * applies, so `nameAuthorContent` takes `includeEmbedded` rather than guessing.
 */
export const EMBEDDED_TAGS: ReadonlySet<string> = new Set([
  'audio',
  'canvas',
  'embed',
  'iframe',
  'img',
  'object',
  'picture',
  'svg',
  'video',
]);

/** Phrasing `doc-*` tags, from the contract's own `inline` flag (§7.5). */
export const INLINE_DOC_TAGS: ReadonlySet<string> = new Set(
  Object.entries(TAGS)
    .filter(([, spec]) => (spec as TagSpec).inline === true)
    .map(([tag]) => tag),
);

/** True for an element name that belongs inside a sentence rather than around one. */
export function isPhrasingTag(tagName: string): boolean {
  const tag = tagName.toLowerCase();
  return PHRASING_TAGS.has(tag) || EMBEDDED_TAGS.has(tag) || INLINE_DOC_TAGS.has(tag);
}

/** True for an element name that embeds an object rather than a run of words. */
export function isEmbeddedTag(tagName: string): boolean {
  return EMBEDDED_TAGS.has(tagName.toLowerCase());
}

export const PARTS: Readonly<Record<string, readonly string[]>> = {
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
  'doc-toc': ['title', 'list', 'item', 'link', 'number', 'label', 'menu-icon', 'toggle-text'],
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
    'open-arrow',
    'endpoint-drawer-close',
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
  'doc-step': ['marker', 'header', 'title', 'body'],
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
  'doc-carousel': ['controls', 'prev-btn', 'next-btn', 'prev-icon', 'next-icon', 'dots', 'dot'],
  'doc-flow': ['arrow', 'arrow-icon'],
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
  'doc-table': ['table', 'scroll-hint'],
  'doc-quote': ['body*', 'cite'],
  'doc-collapse': ['summary', 'chevron', 'summary-text', 'body*'],
};

export const STATES: Readonly<Record<string, readonly string[]>> = {
  'doc-page': ['toc-open', 'toc-docked'],
  'doc-choice': ['answered', 'note-open', 'other-open'],
  'doc-stage': ['open', 'current'],
  'doc-flow-node': ['active'],
  'doc-term': ['first-mention'],
  'doc-collapse': ['open'],
};

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
