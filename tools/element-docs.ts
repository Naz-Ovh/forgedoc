/**
 * The prose half of the markup documentation: what each tag is *for*, the
 * canonical snippet to copy, and the guidance that does not fit in a table.
 *
 * `src/core/contract.ts` holds the mechanical half — tags, attributes, enums,
 * parts, nesting rules — and is the validator's source of truth. This file adds
 * only what cannot be derived from it, and `tests/node/docs.test.ts` fails if the
 * two ever fall out of step.
 *
 * why `tools/` rather than `src/core/`: every byte here is for the CLI and the
 * generated markdown. None of it should reach the browser bundle.
 */

import { type TagName, TAG_NAMES } from '../src/core/contract.js';

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────

export interface Category {
  readonly title: string;
  /** One line on when to reach into this group at all. */
  readonly blurb: string;
  readonly tags: readonly TagName[];
}

/**
 * Every tag, grouped the way an author looks for one.
 *
 * The order is the order of `REFERENCE.md`, `forgedoc elements` and
 * `forgedoc cheatsheet`. A tag missing from here fails the docs test.
 */
export const CATEGORIES: readonly Category[] = [
  {
    title: 'Shell',
    blurb: 'The frame every document needs.',
    tags: ['doc-page', 'doc-header', 'doc-section', 'doc-toc'],
  },
  {
    title: 'Meta & Ownership',
    blurb: 'Who owns the document and what state it is in.',
    tags: ['doc-chips', 'doc-chip', 'doc-owners', 'doc-owner'],
  },
  {
    title: 'Architecture & API',
    blurb: 'Decisions, HTTP operations, parameter specs and procedures.',
    tags: ['doc-decision', 'doc-endpoint', 'doc-params', 'doc-param', 'doc-steps', 'doc-step'],
  },
  {
    title: 'Metrics & Planning',
    blurb: 'Numbers, dates and responsibility grids.',
    tags: ['doc-stats', 'doc-stat', 'doc-timeline', 'doc-milestone', 'doc-matrix'],
  },
  {
    title: 'Prose & Callouts',
    blurb: 'Emphasis inside running text.',
    tags: [
      'doc-badge',
      'doc-note',
      'doc-blocker',
      'doc-blocks',
      'doc-why',
      'doc-action',
      'doc-list',
      'doc-quote',
      'doc-term',
      'doc-ref',
    ],
  },
  {
    title: 'Interactive',
    blurb: 'The parts the reader touches. Answers land in the feedback bucket.',
    tags: [
      'doc-choice',
      'doc-option',
      'doc-rating',
      'doc-checklist',
      'doc-tabs',
      'doc-tab',
      'doc-collapse',
      'doc-carousel',
    ],
  },
  {
    title: 'Structure',
    blurb: 'Sequences, phases, and walkthroughs that play a process step by step.',
    tags: [
      'doc-flow',
      'doc-flow-node',
      'doc-walkthrough',
      'doc-actor',
      'doc-scene',
      'doc-move',
      'doc-change',
      'doc-roadmap',
      'doc-stage',
    ],
  },
  {
    title: 'Content',
    blurb: 'Code, diagrams, tables and trees.',
    tags: [
      'doc-code',
      'doc-diff',
      'doc-figure',
      'doc-caption',
      'doc-table',
      'doc-tree',
      'doc-compare',
      'doc-custom',
    ],
  },
];

/**
 * How the eight categories collapse for `forgedoc cheatsheet`.
 *
 * why merge at all: the cheatsheet MUST fit one printed page, and a table block
 * costs five lines of that page before a single tag appears in it. Eight blocks
 * spend a fifth of the budget on headers. The grouping is by what an author is
 * doing at the time — laying out the shell, writing prose, planning, or dropping
 * in content — which is coarser than the reference needs but is how someone
 * scanning one page actually looks.
 */
export const CHEATSHEET_GROUPS: readonly { title: string; merges: readonly string[] }[] = [
  { title: 'Shell & meta', merges: ['Shell', 'Meta & Ownership'] },
  { title: 'Prose, callouts & specs', merges: ['Prose & Callouts', 'Architecture & API'] },
  { title: 'Metrics, planning & interactive', merges: ['Metrics & Planning', 'Interactive'] },
  { title: 'Structure & content', merges: ['Structure', 'Content'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Per-tag documentation
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementDoc {
  /** Copy-pastable markup in the shape an author should actually write. */
  readonly example: string;
  /**
   * The non-obvious bits: what the runtime derives, what a sibling tag does
   * better, the mistake this tag invites. Skipped when the one-line `doc` on the
   * contract already says everything.
   */
  readonly notes?: readonly string[];
  /** Tags an author reaching for this one often wants instead or as well. */
  readonly related?: readonly TagName[];
}

export const ELEMENT_DOCS: Readonly<Record<TagName, ElementDoc>> = {
  // ── Shell ──────────────────────────────────────────────────────────────────
  'doc-page': {
    example: `<doc-page doc-id="vendor-orders" density="comfortable" accent="teal">
  <doc-header kicker="Plan">Vendor orders</doc-header>
  <doc-section title="Overview"><p>Prose.</p></doc-section>
</doc-page>`,
    notes: [
      'The only root you author, and there is exactly one per document.',
      '`doc-id` is mandatory: it namespaces the reader’s stored answers. Two `file://` documents without distinct ids overwrite each other.',
      'Owns the store, the reading column, the contents panel and the feedback bucket. None of those are tags you write.',
    ],
    related: ['doc-header', 'doc-section'],
  },

  'doc-header': {
    example: `<doc-header kicker="Plan · Q3">
  Vendor order notifications
  <p slot="lede">What we are building and who reads it.</p>
</doc-header>`,
    notes: [
      'The title is the default content — bare text, not an `<h1>`. The heading element is generated.',
      'The optional lede is a `<p slot="lede">`; anything else stays where you put it.',
    ],
  },

  'doc-section': {
    example: `<doc-section title="Data model">
  <p>Prose.</p>
  <doc-section title="Migrations"><p>Nested one level deeper.</p></doc-section>
</doc-section>`,
    notes: [
      'Derives the number, the id (`sec-data-model`), the heading element and the contents entry. Never write any of them.',
      'Nests to depth 3. Deeper than that is a sign the document wants splitting.',
    ],
    related: ['doc-ref', 'doc-collapse'],
  },

  'doc-toc': {
    example: '<!-- Never write this tag. The runtime builds it from your sections. -->',
    notes: [
      'Control it from the root instead: `<doc-page toc="docked">`, or `toc="off"` to drop it.',
      'The reader can change the panel themselves, and the choice is remembered per document.',
    ],
    related: ['doc-page'],
  },

  // ── Meta & Ownership ──────────────────────────────────────────────────────
  'doc-chips': {
    example: `<doc-chips>
  <doc-chip kind="confirmed">Postgres, not DynamoDB</doc-chip>
  <doc-chip kind="pending">Waiting on the rate limit</doc-chip>
</doc-chips>`,
    notes: [
      'Put it directly under `doc-header` for document-level status.',
      'This is where a settled question goes once the reader has answered it — a `doc-choice` they already decided should not be asked twice.',
    ],
    related: ['doc-chip'],
  },

  'doc-chip': {
    example: '<doc-chip kind="confirmed">Postgres, not DynamoDB</doc-chip>',
    notes: [
      '`confirmed` a locked decision, `action` an instruction to the reader, `pending` something still open, `info` plain context.',
    ],
    related: ['doc-chips', 'doc-badge'],
  },

  'doc-owners': {
    example: `<doc-owners>
  <doc-owner name="Alice Chen" role="DRI" status="approved"></doc-owner>
  <doc-owner name="Platform" role="Reviewer" status="reviewing"></doc-owner>
</doc-owners>`,
    related: ['doc-owner'],
  },

  'doc-owner': {
    example: '<doc-owner name="Alice Chen" role="DRI" status="approved"></doc-owner>',
    notes: [
      'The avatar is the first letter of `name` unless you pass `avatar`.',
      'Empty element — everything is attributes.',
    ],
    related: ['doc-owners'],
  },

  // ── Architecture & API ────────────────────────────────────────────────────
  'doc-decision': {
    example: `<doc-decision id="ADR-004" title="Postgres over DynamoDB" status="accepted" date="2026-03-11">
  <p>Relational joins across orders and vendors are the whole query surface.</p>
</doc-decision>`,
    notes: [
      'For a decision already made, with its rationale. Use `doc-choice` for one you still need the reader to make.',
    ],
    related: ['doc-choice'],
  },

  'doc-endpoint': {
    example: `<doc-endpoint method="post" path="/api/v1/orders/{id}/notify"
  summary="Notify the vendor" auth="bearer" status="202 Accepted"
  params="id:path:string:required:Order id; dry_run:query:boolean:optional:Skip delivery"
  response='{ "queued": true }'></doc-endpoint>`,
    notes: [
      'Renders as one compact row that opens a generated OpenAPI-style drawer. The drawer is not markup you write.',
      '`params` is a compact list: `name:in:type:required|optional:description`, entries separated by `;`.',
      'For more than a handful of parameters, nest `doc-param` children instead — the drawer reads both.',
    ],
    related: ['doc-param', 'doc-params'],
  },

  'doc-params': {
    example: `<doc-params>
  <doc-param name="limit" type="number" default="50">Page size.</doc-param>
  <doc-param name="cursor" type="string" required>Opaque page cursor.</doc-param>
</doc-params>`,
    notes: ['Use for CLI flags and function signatures. An HTTP operation wants `doc-endpoint`.'],
    related: ['doc-param', 'doc-endpoint'],
  },

  'doc-param': {
    example: '<doc-param name="limit" type="number" default="50">Page size.</doc-param>',
    notes: ['`in` only means anything inside `doc-endpoint`, where it splits the drawer sections.'],
    related: ['doc-params', 'doc-endpoint'],
  },

  'doc-steps': {
    example: `<doc-steps>
  <doc-step title="Install the CLI" status="completed"><p>\`npm i -g forgedoc\`</p></doc-step>
  <doc-step title="Point it at staging" status="active"><p>Set \`FORGEDOC_ENV\`.</p></doc-step>
</doc-steps>`,
    notes: [
      'A procedure the reader follows. `doc-roadmap` is for delivery phases and `doc-flow` for a pipeline diagram.',
    ],
    related: ['doc-step', 'doc-roadmap', 'doc-flow'],
  },

  'doc-step': {
    example: '<doc-step title="Install the CLI" status="completed"><p>Body.</p></doc-step>',
    related: ['doc-steps'],
  },

  // ── Metrics & Planning ────────────────────────────────────────────────────
  'doc-stats': {
    example: `<doc-stats>
  <doc-stat label="P99 latency" value="&lt; 45ms" trend="down" good diff="-12ms"></doc-stat>
  <doc-stat label="Error rate" value="0.4%" trend="up" tone="bad" diff="+0.1pp"></doc-stat>
</doc-stats>`,
    related: ['doc-stat'],
  },

  'doc-stat': {
    example:
      '<doc-stat label="P99 latency" value="&lt; 45ms" trend="down" good diff="-12ms"></doc-stat>',
    notes: [
      '`trend` is the arrow, `good`/`tone` the colour. They are separate because down is good for latency and bad for revenue.',
    ],
    related: ['doc-stats'],
  },

  'doc-timeline': {
    example: `<doc-timeline>
  <doc-milestone date="2026-04-01" title="Schema frozen" status="completed" owner="Platform"></doc-milestone>
  <doc-milestone date="2026-05-15" title="Vendor pilot" status="in-progress" owner="Growth"></doc-milestone>
</doc-timeline>`,
    related: ['doc-milestone', 'doc-roadmap'],
  },

  'doc-milestone': {
    example:
      '<doc-milestone date="2026-05-15" title="Vendor pilot" status="in-progress" owner="Growth"></doc-milestone>',
    notes: ['Dated events. Unnumbered phases with bodies are `doc-stage` inside `doc-roadmap`.'],
    related: ['doc-timeline'],
  },

  'doc-matrix': {
    example: `<doc-matrix type="raci">
  <table>
    <thead><tr><th>Task</th><th>Platform</th><th>Growth</th></tr></thead>
    <tbody><tr><td>Schema</td><td>R</td><td>C</td></tr></tbody>
  </table>
</doc-matrix>`,
    notes: [
      'Wraps a plain `<table>`. `type` sets the accessible label and the styling; the cells are yours.',
    ],
    related: ['doc-table', 'doc-compare'],
  },

  // ── Prose & Callouts ──────────────────────────────────────────────────────
  'doc-badge': {
    example: '<p>The endpoint is <doc-badge variant="warn">deprecated</doc-badge> from v3.</p>',
    notes: ['Inline, for a word inside a sentence. `doc-chip` is the block-level status pill.'],
    related: ['doc-chip'],
  },

  'doc-note': {
    example: `<doc-note kind="warn" title="One-way migration">
  <p>The backfill cannot be replayed once the old column is dropped.</p>
</doc-note>`,
    notes: ['The icon and the accessible label come from `kind`.'],
    related: ['doc-blocker'],
  },

  'doc-blocker': {
    example: `<doc-blocker title="No staging credentials" severity="high">
  <doc-blocks>The vendor webhook cannot be tested end to end.</doc-blocks>
  <doc-why>The shared account was rotated on Friday.</doc-why>
  <doc-action>Ask #platform-eng for a scoped token.</doc-action>
</doc-blocker>`,
    notes: [
      '`doc-action` is required and the build enforces it. A roadblock with no stated way out is the failure this library exists to prevent.',
      'For a caveat rather than a blockage, use `doc-note kind="warn"`.',
    ],
    related: ['doc-blocks', 'doc-why', 'doc-action', 'doc-note'],
  },

  'doc-blocks': {
    example: '<doc-blocks>The vendor webhook cannot be tested end to end.</doc-blocks>',
    notes: ['The "what it blocks" line. The label is generated.'],
    related: ['doc-blocker'],
  },

  'doc-why': {
    example: '<doc-why>The shared account was rotated on Friday.</doc-why>',
    notes: ['The "why it happened" line. Optional.'],
    related: ['doc-blocker'],
  },

  'doc-action': {
    example: '<doc-action>Ask #platform-eng for a scoped token.</doc-action>',
    notes: ['The "what unblocks it" line. Required inside every `doc-blocker`.'],
    related: ['doc-blocker'],
  },

  'doc-list': {
    example: `<doc-list marker="check" title="Already built">
  <li>Order ingestion</li>
  <li>Vendor directory</li>
</doc-list>`,
    notes: [
      'Children are plain `<li>`. The glyph is a real text node, so it survives copy-paste and find-in-page.',
      '`kind` only colours the column when the list sits inside `doc-compare`.',
      'For an ordinary bulleted list in prose, plain `<ul>` is already styled.',
    ],
    related: ['doc-compare', 'doc-checklist'],
  },

  'doc-quote': {
    example:
      '<doc-quote cite="Vendor interview, March 2026">We find out an order landed when the customer calls us.</doc-quote>',
    notes: ['The quoted text is bare content. `cite` generates the attribution line.'],
    related: ['doc-note'],
  },

  'doc-term': {
    example:
      '<p>Delivery goes through the <doc-term href="https://example.com/docs/outbox">outbox</doc-term>.</p>',
    notes: [
      'The first mention is styled differently from repeats. The runtime tracks which is which.',
    ],
    related: ['doc-ref'],
  },

  'doc-ref': {
    example: '<p>Covered in <doc-ref to="sec-data-model"></doc-ref>.</p>',
    notes: [
      'Resolves to the live number at mount, so it cannot go stale when a section moves.',
      'Never write "see Stage 5". A hardcoded number is a latent bug from the moment something is inserted above it.',
    ],
    related: ['doc-section'],
  },

  // ── Interactive ───────────────────────────────────────────────────────────
  'doc-choice': {
    example: `<doc-choice question="Should read state be shared across the vendor team?" mode="single">
  <doc-option recommended>
    Yes — one shared inbox
    <p slot="desc">Matches how vendors already work the queue.</p>
  </doc-option>
  <doc-option>Per-user, unread counts each</doc-option>
  <doc-option other>Something else</doc-option>
</doc-choice>`,
    notes: [
      'The point of the format. Put one wherever you made a judgement call, and mark your suggestion `recommended`.',
      'Letters, the id, the note field and the ARIA radiogroup are all derived.',
      'The answer travels back in the feedback bucket carrying the question and label verbatim, so you can read it without the original file.',
    ],
    related: ['doc-option', 'doc-rating', 'doc-decision'],
  },

  'doc-option': {
    example: `<doc-option recommended>
  Yes — one shared inbox
  <p slot="desc">Why this is the right default.</p>
</doc-option>`,
    notes: [
      'The label is the default content; the trade-off goes in `<p slot="desc">`.',
      '`other` reveals a free-text input and is only valid on the last option.',
      'Never write the A/B/C letter.',
    ],
    related: ['doc-choice'],
  },

  'doc-rating': {
    example:
      '<doc-rating question="How confident are you in this estimate?" scale="5"></doc-rating>',
    notes: [
      'For a magnitude. A choice between named options is `doc-choice`.',
      '`scale` is clamped to 3–10.',
    ],
    related: ['doc-choice'],
  },

  'doc-checklist': {
    example: `<doc-checklist>
  <li>Schema reviewed</li>
  <li>Runbook updated</li>
</doc-checklist>`,
    notes: [
      'Children are plain `<li>`. Check state persists per `doc-id`, so it survives a reload.',
      'For a static ✓ list that is not meant to be ticked, use `doc-list marker="check"`.',
    ],
    related: ['doc-list'],
  },

  'doc-tabs': {
    example: `<doc-tabs>
  <doc-tab label="Before" active><p>Today’s flow.</p></doc-tab>
  <doc-tab label="After"><p>The proposed flow.</p></doc-tab>
</doc-tabs>`,
    notes: ['For alternatives the reader picks between. Side-by-side comparison is `doc-compare`.'],
    related: ['doc-tab', 'doc-compare'],
  },

  'doc-tab': {
    example: '<doc-tab label="Before" active><p>Body.</p></doc-tab>',
    notes: ['Without `active` on any tab, the first one opens.'],
    related: ['doc-tabs'],
  },

  'doc-collapse': {
    example: `<doc-collapse title="Full migration SQL" sticky>
  <doc-code lang="sql">alter table orders add column notified_at timestamptz;</doc-code>
</doc-collapse>`,
    notes: [
      'For detail that would otherwise bury the argument.',
      '`sticky` remembers the reader’s choice across reloads; without it the `open` attribute wins on every load.',
    ],
    related: ['doc-stage', 'doc-section'],
  },

  'doc-carousel': {
    example: `<doc-carousel title="Screens">
  <doc-figure type="image" src="./one.png" caption="Inbox"></doc-figure>
  <doc-figure type="image" src="./two.png" caption="Detail"></doc-figure>
</doc-carousel>`,
    notes: ['Slides are the direct children. Hiding a slide never removes it from the DOM.'],
    related: ['doc-figure'],
  },

  // ── Structure ─────────────────────────────────────────────────────────────
  'doc-flow': {
    example: `<doc-flow>
  <doc-flow-node title="Order lands">webhook</doc-flow-node>
  <doc-flow-node title="Outbox" active>durable</doc-flow-node>
  <doc-flow-node title="Vendor notified">email</doc-flow-node>
</doc-flow>`,
    notes: [
      'A short linear pipeline, laid out in the document’s own type. Arrows and wrapping are automatic.',
      'When the interesting part is what happens along the way — a request rejected, a row copied, a state that changes — `doc-walkthrough` plays it scene by scene.',
    ],
    related: ['doc-flow-node', 'doc-walkthrough'],
  },

  'doc-flow-node': {
    example: '<doc-flow-node title="Outbox" active>durable</doc-flow-node>',
    notes: ['The child text is the subtitle. `active` marks the current or recommended path.'],
    related: ['doc-flow'],
  },

  'doc-walkthrough': {
    example: `<doc-walkthrough title="One login, one surface">
  <doc-actor name="vendor" label="Vendor panel" kind="app" tone="cyan"></doc-actor>
  <doc-actor name="guard" label="authenticateVendor" kind="service"></doc-actor>
  <doc-actor name="admin" label="Admin route" kind="service" tone="violet"></doc-actor>
  <doc-scene title="Vendor signs in">
    <doc-move from="vendor" to="guard" token="ub_vendor_session" result="accept"></doc-move>
    <p>The vendor panel sends only its own cookie.</p>
  </doc-scene>
  <doc-scene title="Wrong door">
    <doc-move from="vendor" to="admin" token="ub_vendor_session" result="reject"></doc-move>
    <p>An admin route never reads the vendor cookie, so the answer is 401.</p>
  </doc-scene>
</doc-walkthrough>`,
    notes: [
      'Use it when motion explains something words make hard: a request that is accepted or refused, data copied between tables, a state that changes over steps. A plain sequence is `doc-flow`.',
      'You write only actors and scenes. The stage, the animation, Play / Prev / Next, the dots, arrow keys, reduced-motion handling and a text transcript are generated.',
      'Keep each caption to a sentence or two — the motion carries the meaning. Every scene takes comments.',
      'Close every tag: `<doc-actor …></doc-actor>`. HTML has no self-closing custom elements, so `<doc-actor/>` swallows everything after it, and the build rejects it.',
    ],
    related: ['doc-actor', 'doc-scene', 'doc-move', 'doc-change', 'doc-flow'],
  },

  'doc-actor': {
    example: `<doc-actor name="users" label="users" kind="table" tone="amber">
  shared today
  <ul><li>1 · ana · customer</li><li>2 · bo · vendor</li></ul>
</doc-actor>`,
    notes: [
      '`name` is the key scenes use; `label` is what the card says.',
      'Loose text is a short note under the label. A child `<ul>` gives the starting rows.',
      '`absent` draws a dashed placeholder until a `doc-change` first touches the actor — a table that does not exist yet.',
    ],
    related: ['doc-walkthrough', 'doc-change'],
  },

  'doc-scene': {
    example: `<doc-scene title="Wrong door" focus="vendor admin">
  <doc-move from="vendor" to="admin" token="ub_vendor_session" result="reject"></doc-move>
  <p>An admin route never reads the vendor cookie.</p>
</doc-scene>`,
    notes: [
      'Steps play in the order written. Everything that is not a `doc-move` or `doc-change` is the caption.',
      'The actors a scene touches are highlighted and the rest dim; `focus` overrides that.',
    ],
    related: ['doc-walkthrough', 'doc-move', 'doc-change'],
  },

  'doc-move': {
    example:
      '<doc-move from="vendor" to="admin" token="ub_vendor_session" result="reject"></doc-move>',
    notes: [
      '`result="accept"` lands with a green tick, `reject` bounces off with a red cross; leave it out for a plain hand-off.',
      'A reply is just another move in the other direction. It arcs the other way, so the pair reads as request and response.',
    ],
    related: ['doc-scene', 'doc-change'],
  },

  'doc-change': {
    example: '<doc-change actor="vendor_accounts" add="7 · bo@shop.eu" tone="good"></doc-change>',
    notes: [
      'Changes accumulate: a row added in scene two is still there in scene five. Jumping between scenes rebuilds that state exactly.',
      '`set` replaces the actor’s status pill; `remove` strikes a row by its text; `drop` retires the whole actor.',
    ],
    related: ['doc-scene', 'doc-actor'],
  },

  'doc-roadmap': {
    example: `<doc-roadmap start="1">
  <doc-stage title="Ingestion" subtitle="2 weeks" current open>
    <p>What lands in this phase.</p>
  </doc-stage>
  <doc-stage title="Notification" subtitle="3 weeks"><p>Next.</p></doc-stage>
</doc-roadmap>`,
    notes: ['Delivery phases with bodies. Dated events are `doc-timeline`.'],
    related: ['doc-stage', 'doc-timeline'],
  },

  'doc-stage': {
    example:
      '<doc-stage title="Ingestion" subtitle="2 weeks" current open><p>Body.</p></doc-stage>',
    notes: [
      'The badge number and the anchor id are derived. Reference it with `doc-ref`, never by typing the number.',
    ],
    related: ['doc-roadmap', 'doc-ref'],
  },

  // ── Content ───────────────────────────────────────────────────────────────
  'doc-code': {
    example: `<doc-code lang="ts" title="src/outbox.ts" highlight="2-3">
export async function enqueue(order: Order) {
  await db.insert(outbox).values({ orderId: order.id });
  return { queued: true };
}
</doc-code>`,
    notes: [
      '`lang` is required, and a language outside the allowlist is a build error rather than a silent fallback to plain text.',
      'Line numbers, the copy button and the highlight overlay are generated. Escape `<` as `&lt;` in the body.',
    ],
    related: ['doc-diff'],
  },

  'doc-diff': {
    example: `<doc-diff lang="ts" filename="src/outbox.ts">
-  await send(order);
+  await enqueue(order);
</doc-diff>`,
    notes: ['A unified diff body. The +/- counts in the header are derived.'],
    related: ['doc-code'],
  },

  'doc-figure': {
    example: `<doc-figure type="mermaid" caption="How a plan travels from the agent to the reader and back">
flowchart LR
  A[Agent] --> B[Document] --> C[Reader] --> D[Bucket] --> A
</doc-figure>`,
    notes: [
      'Prefer `type="mermaid"` over hand-drawn SVG: five lines replaces hundreds of hand-placed coordinates, and it renders in the document’s own colours.',
      '`type="html"` renders inside a sandboxed `<iframe srcdoc>`, never inline.',
      'Mermaid is only embedded by `--offline` builds, and it is most of their weight.',
    ],
    related: ['doc-caption', 'doc-flow'],
  },

  'doc-caption': {
    example: `<doc-figure type="mermaid">
flowchart LR
  A --> B
  <doc-caption>See <doc-ref to="sec-data-model"></doc-ref> for the schema.</doc-caption>
</doc-figure>`,
    notes: ['Only needed when the caption contains links, terms or refs. Otherwise use `caption`.'],
    related: ['doc-figure'],
  },

  'doc-table': {
    example: `<doc-table size="sm">
  <table>
    <thead><tr><th>Field</th><th>Type</th></tr></thead>
    <tbody><tr><td>notified_at</td><td>timestamptz</td></tr></tbody>
  </table>
</doc-table>`,
    notes: [
      'You write the `<table>` yourself — the component only enhances it, and never reparents it.',
      'The stacked cards take their labels from the `<thead>` text. `stack="never"` opts out of both the restacking and the labelling.',
    ],
    related: ['doc-matrix', 'doc-compare'],
  },

  'doc-tree': {
    example: `<doc-tree root="src/">
  <li>core/
    <ul><li>contract.ts</li></ul>
  </li>
  <li>index.ts</li>
</doc-tree>`,
    notes: ['Connector lines and folder icons are generated from nested `<ul>`/`<li>`.'],
  },

  'doc-compare': {
    example: `<doc-compare columns="2">
  <doc-list kind="positive" marker="check" title="Outbox"><li>Survives a restart</li></doc-list>
  <doc-list kind="negative" marker="cross" title="Direct send"><li>Lost on deploy</li></doc-list>
</doc-compare>`,
    notes: [
      'Columns are `doc-list` blocks with a `title`. Collapses to one column on a narrow viewport.',
    ],
    related: ['doc-list', 'doc-tabs'],
  },

  'doc-custom': {
    example: `<doc-custom title="Which cookie each surface reads">
  <style>
    .jar { display: flex; flex-wrap: wrap; gap: var(--doc-space-2); }
    .jar b { padding: var(--doc-space-1) var(--doc-space-3); border-radius: var(--doc-radius-pill);
             background: var(--doc-accent-tint); color: var(--doc-accent-text); }
  </style>
  <div class="jar"><b>ub_customer_session</b><b>ub_vendor_session</b><b>ub_admin_session</b></div>
  <script type="forgedoc">
    block.querySelector('.jar').addEventListener('click', () => block.classList.toggle('open'));
  </script>
</doc-custom>`,
    notes: [
      'For the one idea no built-in element explains well. Inside it, `<style>`, `<script>` and `class=` are yours.',
      'Styles are scoped to the block — the build wraps them in `@scope` — so nothing leaks into the page. Use the `--doc-*` tokens to follow the theme and dark mode.',
      'Scripts need `type="forgedoc"`. They run once, after the page is ready, in their own scope, with `block` (this element) and `reducedMotion` in hand. A plain `<script>` runs too early and shares the global scope.',
      'Commentable like any block. Keep it small; if you are rebuilding a table, a flow or a walkthrough, use that element instead.',
    ],
    related: ['doc-figure', 'doc-walkthrough'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Prose that is not per-tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The rules an author breaks first, in the order they break them.
 *
 * Each entry completes the sentence "Never write …", so it starts with the thing
 * itself rather than repeating the instruction.
 */
export const NEVER_WRITE = [
  '`<style>`, `<script>`, `class=`, `role=` or `aria-*` outside `doc-custom` — the runtime owns them.',
  'section numbers (`1.2.1`), stage numbers, or option letters (`A`/`B`/`C`) — every one is derived, and a typed one goes stale.',
  '`id=` — ids come from `title` and `question`. Override only for an anchor that must survive a reworded heading.',
  '`doc-toc` — generated from your sections. Steer it with `<doc-page toc="docked">`.',
] as const;

/** Plain HTML that is already styled, so there is deliberately no tag for it. */
export const PLAIN_HTML = [
  'p',
  'ul',
  'ol',
  'li',
  'code',
  'a',
  'strong',
  'em',
  'table',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
] as const;

/** The two placeholders `forgedoc build` substitutes, and where each belongs. */
export const PLACEHOLDERS = {
  css: '<style>/*@DOC_CSS@*/</style>',
  js: '<script>//@DOC_JS@</script>',
} as const;

export interface GuideSection {
  readonly title: string;
  readonly body: string;
}

/**
 * The conceptual material `forgedoc reference` prints above the tag tables.
 *
 * It answers the questions the per-tag docs cannot: what is public API, how to
 * override styling without fighting specificity, and why the agent never writes
 * ARIA.
 */
export const GUIDE: readonly GuideSection[] = [
  {
    title: 'How to read this',
    body: `**Attributes** are what you write. **Parts** are the public \`data-part\`
surface. **States** are custom states, targetable as \`:state(name)\`. Everything
else — class names, element structure, the shape of generated chrome — is
internal and will change without a major version.

- A tag marked **generated** is created by the runtime. Writing it by hand is a
  build error.
- A tag marked **only valid inside** is a child-only tag; the validator rejects
  it anywhere else.
- A part marked with \`*\` exists only when you wrapped that content in an element
  of your own. In the recommended authoring form the content arrives as a bare
  text node, and wrapping it would mean moving author content, which the runtime
  never does. Those components carry the typography on the host element instead —
  style \`doc-quote\` itself, not \`doc-quote [data-part="body"]\`.`,
  },
  {
    title: 'The three override tiers',
    body: `In order of preference (§6.6):

1. **Preset attributes** — \`<doc-page density="compact">\`. Validated against an
   enum, switchable at runtime with one \`setAttribute\`, and reachable from the
   print stylesheet.
2. **Token override** — \`doc-note { --doc-accent-600: #8b5cf6 }\`. Semantic, and
   survives a library upgrade. Custom properties inherit, so this works on any
   subtree: \`<doc-table style="--doc-space-unit: 3px">\`.
3. **Raw CSS** — \`doc-note [data-part="title"] { letter-spacing: .02em }\`.

Tier 3 needs no \`!important\` and no specificity arithmetic. Every rule the
library ships lives inside \`@layer doc.*\`, and unlayered author CSS beats
layered CSS outright:

\`\`\`css
/* wins against every shipped rule */
doc-note {
  border-radius: 0;
}
\`\`\`

Only \`data-part\` selectors are public API. Internal class names are not.`,
  },
  {
    title: 'ARIA',
    body: `You never write \`role=\` or \`aria-*\`. Components set them through
\`ElementInternals\` at upgrade, which keeps accessibility semantics out of the
markup you have to remember and out of the DOM an author might edit.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────────

/** Category title per tag, for `forgedoc info` and search results. */
export const CATEGORY_OF: Readonly<Record<string, string>> = Object.fromEntries(
  CATEGORIES.flatMap((category) => category.tags.map((tag) => [tag, category.title])),
);

/**
 * Tags in documentation order.
 *
 * why not `TAG_NAMES`: that follows the declaration order of the contract, which
 * is grouped for the validator's benefit. Readers want the category order.
 */
export const DOCUMENTED_TAGS: readonly TagName[] = CATEGORIES.flatMap((category) => category.tags);

/** Tags declared in the contract but absent from `CATEGORIES`. Should be empty. */
export function undocumentedTags(): readonly string[] {
  return TAG_NAMES.filter((name) => !(name in CATEGORY_OF));
}
