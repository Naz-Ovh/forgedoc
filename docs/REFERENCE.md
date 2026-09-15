# ForgeDoc reference

The complete per-component API. `forgedoc cheatsheet` is the one-page version
to keep open while writing; `forgedoc info <element>` is a single entry.

## How to read this

**Attributes** are what you write. **Parts** are the public `data-part`
surface. **States** are custom states, targetable as `:state(name)`. Everything
else — class names, element structure, the shape of generated chrome — is
internal and will change without a major version.

- A tag marked **generated** is created by the runtime. Writing it by hand is a
  build error.
- A tag marked **only valid inside** is a child-only tag; the validator rejects
  it anywhere else.
- A part marked with `*` exists only when you wrapped that content in an element
  of your own. In the recommended authoring form the content arrives as a bare
  text node, and wrapping it would mean moving author content, which the runtime
  never does. Those components carry the typography on the host element instead —
  style `doc-quote` itself, not `doc-quote [data-part="body"]`.

## The three override tiers

In order of preference (§6.6):

1. **Preset attributes** — `<doc-page density="compact">`. Validated against an
   enum, switchable at runtime with one `setAttribute`, and reachable from the
   print stylesheet.
2. **Token override** — `doc-note { --doc-accent-600: #8b5cf6 }`. Semantic, and
   survives a library upgrade. Custom properties inherit, so this works on any
   subtree: `<doc-table style="--doc-space-unit: 3px">`.
3. **Raw CSS** — `doc-note [data-part="title"] { letter-spacing: .02em }`.

Tier 3 needs no `!important` and no specificity arithmetic. Every rule the
library ships lives inside `@layer doc.*`, and unlayered author CSS beats
layered CSS outright:

```css
/* wins against every shipped rule */
doc-note {
  border-radius: 0;
}
```

Only `data-part` selectors are public API. Internal class names are not.

## ARIA

You never write `role=` or `aria-*`. Components set them through
`ElementInternals` at upgrade, which keeps accessibility semantics out of the
markup you have to remember and out of the DOM an author might edit.

## Global attributes

Accepted on every `doc-*` tag.

| Attribute | Values | Notes |
| --- | --- | --- |
| `id` | slug (`[a-z0-9-]+`) | Override the derived id. Prefer letting the runtime derive it. |
| `class` | string | Author styling hook. Not used by the library. |
| `style` | string | Inline token override, e.g. `--doc-space-unit: 3px`. |
| `hidden` | boolean | Standard HTML `hidden`. |
| `lang` | string | Standard HTML `lang`. |
| `dir` | `ltr` \| `rtl` \| `auto` | Standard HTML `dir`. |

## Shell

_The frame every document needs._

### `<doc-page>`

The root, and the only authored root. Owns the store, the layout column, the TOC and the bucket.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `doc-id` | slug (`[a-z0-9-]+`) | **yes** | Storage namespace. Required — see §9.3, `file://` shares one localStorage bucket. |
| `density` | `compact` \| `comfortable` \| `spacious` | no | Spacing unit, line-height and component padding. Defaults to `comfortable`. |
| `scale` | `sm` \| `md` \| `lg` | no | Type scale base size and ratio. Defaults to `md`. |
| `accent` | `teal` \| `indigo` \| `slate` \| `plum` \| `amber` | no | Accent ramp and derived tints. Defaults to `teal`. |
| `measure` | `narrow` \| `default` \| `wide` | no | Reading column width: 720 / 1200 / 1600px. Defaults to `default`. |
| `code` | `auto` \| `light` \| `dark` | no | Prism theme: follow the document, or force light/dark. Defaults to `auto`. |
| `toc` | `open` \| `closed` \| `docked` \| `off` | no | Contents panel: floating open, collapsed, docked beside the content, or absent. Defaults to floating and collapsed; the reader can change it and the choice is remembered. |
| `numbering` | `counter` \| `text` | no | Section numbers as CSS counters (default, cheap) or real selectable text nodes. |

- The only root you author, and there is exactly one per document.

- `doc-id` is mandatory: it namespaces the reader’s stored answers. Two `file://` documents without distinct ids overwrite each other.

- Owns the store, the reading column, the contents panel and the feedback bucket. None of those are tags you write.

```html
<doc-page doc-id="vendor-orders" density="comfortable" accent="teal">
  <doc-header kicker="Plan">Vendor orders</doc-header>
  <doc-section title="Overview"><p>Prose.</p></doc-section>
</doc-page>
```

- **Parts:** `canvas`, `rail`, `prose`, `aside`, `toc`, `toc-backdrop`, `bucket`, `bucket-fab`, `bucket-panel`, `bucket-header`, `bucket-body`, `bucket-empty`, `bucket-item`, `bucket-item-remove`, `bucket-copy`, `bucket-copied`, `bucket-badge`, `bucket-note`, `settings-toggle`, `theme-toggle`, `density-toggle`

- **States:** `:toc-open`, `:toc-docked`

- **See also:** `<doc-header>`, `<doc-section>`

### `<doc-header>`

Document title block. Heading text is the default content; an optional `<p slot="lede">` follows.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `kicker` | string | no | Small-caps eyebrow line above the title. |

- The title is the default content — bare text, not an `<h1>`. The heading element is generated.

- The optional lede is a `<p slot="lede">`; anything else stays where you put it.

```html
<doc-header kicker="Plan · Q3">
  Vendor order notifications
  <p slot="lede">What we are building and who reads it.</p>
</doc-header>
```

- **Parts:** `title`, `lede`, `kicker`, `rule`

### `<doc-section>`

Structural section. Derives its anchor id and heading from `title`. Nestable up to 3 deep.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | **yes** | Section heading text. Derives the section id for TOC and deep-linking. |

- Derives the number, the id (`sec-data-model`), the heading element and the contents entry. Never write any of them.

- Nests to depth 3. Deeper than that is a sign the document wants splitting.

```html
<doc-section title="Data model">
  <p>Prose.</p>
  <doc-section title="Migrations"><p>Nested one level deeper.</p></doc-section>
</doc-section>
```

- **Parts:** `heading`, `title`, `number`, `anchor`, `body`

- **See also:** `<doc-ref>`, `<doc-collapse>`

### `<doc-toc>`

Table of contents navigation panel.

- Control it from the root instead: `<doc-page toc="docked">`, or `toc="off"` to drop it.

- The reader can change the panel themselves, and the choice is remembered per document.

```html
<!-- Never write this tag. The runtime builds it from your sections. -->
```

- **Parts:** `title`, `list`, `item`, `link`, `number`, `label`, `menu-icon`, `toggle-text`

- **Generated by the runtime.**

- **See also:** `<doc-page>`

## Meta & Ownership

_Who owns the document and what state it is in._

### `<doc-chips>`

A flex row of meta pills (tags, versions, reviewers).

- Put it directly under `doc-header` for document-level status.

- This is where a settled question goes once the reader has answered it — a `doc-choice` they already decided should not be asked twice.

```html
<doc-chips>
  <doc-chip kind="confirmed">Postgres, not DynamoDB</doc-chip>
  <doc-chip kind="pending">Waiting on the rate limit</doc-chip>
</doc-chips>
```

- **See also:** `<doc-chip>`

### `<doc-chip>`

A single status / metadata pill.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `confirmed` \| `info` \| `action` \| `pending` | no | Locked decision, plain context, an instruction to the reader, or something still open. Defaults to `info`. |

- `confirmed` a locked decision, `action` an instruction to the reader, `pending` something still open, `info` plain context.

```html
<doc-chip kind="confirmed">Postgres, not DynamoDB</doc-chip>
```

- **Only valid inside:** `<doc-chips>`

- **See also:** `<doc-chips>`, `<doc-badge>`

### `<doc-owners>`

Document authors, owners, and DRI sign-off status block.

```html
<doc-owners>
  <doc-owner name="Alice Chen" role="DRI" status="approved"></doc-owner>
  <doc-owner name="Platform" role="Reviewer" status="reviewing"></doc-owner>
</doc-owners>
```

- **See also:** `<doc-owner>`

### `<doc-owner>`

Single owner or reviewer entry with avatar, name, role, and approval status.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | **yes** | Name of the person or team. |
| `role` | string | no | DRI, Reviewer, Lead, etc. Defaults to `Owner`. |
| `avatar` | string | no | Glyph or initials for the avatar. Defaults to the first letter of `name`. |
| `status` | `approved` \| `pending` \| `reviewing` \| `rejected` | no | Sign-off status. Defaults to `reviewing`. |

- The avatar is the first letter of `name` unless you pass `avatar`.

- Empty element — everything is attributes.

```html
<doc-owner name="Alice Chen" role="DRI" status="approved"></doc-owner>
```

- **Parts:** `avatar`, `info`, `name`, `role`, `status`

- **Only valid inside:** `<doc-owners>`

- **See also:** `<doc-owners>`

## Architecture & API

_Decisions, HTTP operations, parameter specs and procedures._

### `<doc-decision>`

Architecture Decision Record (ADR) / RFC card with structured header and rationale body.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | no | ADR identifier (e.g. ADR-001). |
| `title` | string | **yes** | Decision title / summary. |
| `status` | `accepted` \| `proposed` \| `rejected` \| `deprecated` \| `superseded` | no | Status of the architectural decision. |
| `date` | string | no | ISO date string or human date. |

- For a decision already made, with its rationale. Use `doc-choice` for one you still need the reader to make.

```html
<doc-decision id="ADR-004" title="Postgres over DynamoDB" status="accepted" date="2026-03-11">
  <p>Relational joins across orders and vendors are the whole query surface.</p>
</doc-decision>
```

- **Parts:** `header`, `badge-id`, `status`, `title`, `date`, `body`

- **See also:** `<doc-choice>`

### `<doc-endpoint>`

Compact HTTP API operation button that opens a generated OpenAPI-style detail drawer.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `method` | `get` \| `post` \| `put` \| `patch` \| `delete` \| `options` \| `head` | **yes** | HTTP method. |
| `path` | string | **yes** | API route URL path (e.g. `/api/v1/users/{id}`). |
| `summary` | string | no | Short operation label shown in the endpoint row and drawer heading. |
| `description` | string | no | Longer operation explanation shown only in the generated drawer. |
| `auth` | `bearer` \| `basic` \| `api-key` \| `session` \| `none` | no | Authentication requirement. |
| `headers` | string | no | Semicolon or comma-separated list of request headers (e.g. `Content-Type: application/json; Authorization: Bearer ...`). |
| `params` | string | no | Compact semicolon-separated parameters: `name:in:type:required\|optional:description`. |
| `request` | string | no | Optional request example rendered as code in the drawer. |
| `status` | string | no | Expected HTTP response status code and description (e.g. `200 OK`, `201 Created`). |
| `response` | string | no | Optional response example rendered as code in the drawer. |

- Renders as one compact row that opens a generated OpenAPI-style drawer. The drawer is not markup you write.

- `params` is a compact list: `name:in:type:required|optional:description`, entries separated by `;`.

- For more than a handful of parameters, nest `doc-param` children instead — the drawer reads both.

```html
<doc-endpoint method="post" path="/api/v1/orders/{id}/notify"
  summary="Notify the vendor" auth="bearer" status="202 Accepted"
  params="id:path:string:required:Order id; dry_run:query:boolean:optional:Skip delivery"
  response='{ "queued": true }'></doc-endpoint>
```

- **Parts:** `trigger`, `method`, `path`, `path-param`, `summary`, `status`, `open-icon`, `open-arrow`, `endpoint-drawer-close`, `body`, `endpoint-drawer`, `endpoint-drawer-header`, `endpoint-drawer-signature`, `endpoint-drawer-content`, `endpoint-drawer-section`, `endpoint-drawer-parameter`, `endpoint-drawer-example`, `endpoint-drawer-response-status`

- **See also:** `<doc-param>`, `<doc-params>`

### `<doc-params>`

Parameter / argument specification table for APIs, CLI options, and function signatures.

- Use for CLI flags and function signatures. An HTTP operation wants `doc-endpoint`.

```html
<doc-params>
  <doc-param name="limit" type="number" default="50">Page size.</doc-param>
  <doc-param name="cursor" type="string" required>Opaque page cursor.</doc-param>
</doc-params>
```

- **See also:** `<doc-param>`, `<doc-endpoint>`

### `<doc-param>`

Single parameter item with name, type, requirement badge, default value, and description.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | **yes** | Parameter name. |
| `type` | string | no | Type signature (e.g. `string`, `number`, `boolean`). |
| `in` | `path` \| `query` \| `header` \| `body` | no | Where the API parameter is sent. Defaults to `query`. |
| `required` | boolean | no | Whether the parameter is mandatory. |
| `default` | string | no | Default value if omitted. |

- `in` only means anything inside `doc-endpoint`, where it splits the drawer sections.

```html
<doc-param name="limit" type="number" default="50">Page size.</doc-param>
```

- **Parts:** `header`, `name`, `type`, `badge`, `default`, `body`

- **Only valid inside:** `<doc-params>`, `<doc-endpoint>`

- **See also:** `<doc-params>`, `<doc-endpoint>`

### `<doc-steps>`

Sequential step-by-step procedure or setup walkthrough list.

- A procedure the reader follows. `doc-roadmap` is for delivery phases and `doc-flow` for a pipeline diagram.

```html
<doc-steps>
  <doc-step title="Install the CLI" status="completed"><p>`npm i -g forgedoc`</p></doc-step>
  <doc-step title="Point it at staging" status="active"><p>Set `FORGEDOC_ENV`.</p></doc-step>
</doc-steps>
```

- **See also:** `<doc-step>`, `<doc-roadmap>`, `<doc-flow>`

### `<doc-step>`

A single step in a step-by-step sequence with title, status, and description.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | **yes** | Step title. |
| `status` | `completed` \| `active` \| `pending` \| `optional` | no | Progress status of the step. |

```html
<doc-step title="Install the CLI" status="completed"><p>Body.</p></doc-step>
```

- **Parts:** `marker`, `header`, `title`, `body`

- **Only valid inside:** `<doc-steps>`

- **See also:** `<doc-steps>`

## Metrics & Planning

_Numbers, dates and responsibility grids._

### `<doc-stats>`

A metric / KPI card grid layout.

```html
<doc-stats>
  <doc-stat label="P99 latency" value="&lt; 45ms" trend="down" good diff="-12ms"></doc-stat>
  <doc-stat label="Error rate" value="0.4%" trend="up" tone="bad" diff="+0.1pp"></doc-stat>
</doc-stats>
```

- **See also:** `<doc-stat>`

### `<doc-stat>`

Single metric / KPI card displaying value, label, trend arrow, and delta difference.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `label` | string | **yes** | Metric label. |
| `value` | string | **yes** | Value text or number. |
| `trend` | `up` \| `down` \| `flat` | no | Directional indicator arrow. |
| `good` | boolean | no | Whether the trend direction is positive. |
| `tone` | `good` \| `bad` \| `neutral` | no | Colour of the delta when `good` does not apply. Defaults to `neutral`. |
| `diff` | string | no | Delta text (e.g. +15%, -2ms). |

- `trend` is the arrow, `good`/`tone` the colour. They are separate because down is good for latency and bad for revenue.

```html
<doc-stat label="P99 latency" value="&lt; 45ms" trend="down" good diff="-12ms"></doc-stat>
```

- **Parts:** `label`, `value-row`, `value`, `diff`, `body`

- **Only valid inside:** `<doc-stats>`

- **See also:** `<doc-stats>`

### `<doc-timeline>`

Delivery milestone timeline container.

```html
<doc-timeline>
  <doc-milestone date="2026-04-01" title="Schema frozen" status="completed" owner="Platform"></doc-milestone>
  <doc-milestone date="2026-05-15" title="Vendor pilot" status="in-progress" owner="Growth"></doc-milestone>
</doc-timeline>
```

- **See also:** `<doc-milestone>`, `<doc-roadmap>`

### `<doc-milestone>`

A milestone event in a delivery timeline with date, title, owner, and status.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `date` | string | **yes** | Target date or release milestone. |
| `title` | string | **yes** | Milestone title. |
| `status` | `completed` \| `in-progress` \| `planned` \| `delayed` | no | Status of the milestone. |
| `owner` | string | no | Owner or squad responsible. |

- Dated events. Unnumbered phases with bodies are `doc-stage` inside `doc-roadmap`.

```html
<doc-milestone date="2026-05-15" title="Vendor pilot" status="in-progress" owner="Growth"></doc-milestone>
```

- **Parts:** `header`, `marker`, `date`, `title`, `owner`, `status`, `body`

- **Only valid inside:** `<doc-timeline>`

- **See also:** `<doc-timeline>`

### `<doc-matrix>`

Structured decision or RACI matrix wrapper.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `type` | `raci` \| `risk` \| `comparison` \| `custom` | no | Type of matrix table. Defaults to `comparison`. |

- Wraps a plain `<table>`. `type` sets the accessible label and the styling; the cells are yours.

```html
<doc-matrix type="raci">
  <table>
    <thead><tr><th>Task</th><th>Platform</th><th>Growth</th></tr></thead>
    <tbody><tr><td>Schema</td><td>R</td><td>C</td></tr></tbody>
  </table>
</doc-matrix>
```

- **See also:** `<doc-table>`, `<doc-compare>`

## Prose & Callouts

_Emphasis inside running text._

### `<doc-badge>`

Compact status tag / label pill.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `variant` | `info` \| `success` \| `warn` \| `danger` \| `neutral` \| `accent` | no | Visual variant of the badge. |

- Inline, for a word inside a sentence. `doc-chip` is the block-level status pill.

```html
<p>The endpoint is <doc-badge variant="warn">deprecated</doc-badge> from v3.</p>
```

- **Inline element.**

- **See also:** `<doc-chip>`

### `<doc-note>`

Callout block with icon and tone ramp.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `info` \| `tip` \| `warn` \| `danger` \| `success` | no | Tone: blue info (default), green tip, amber warn, red danger, green success. |
| `title` | string | no | Optional bold heading on the callout. |

- The icon and the accessible label come from `kind`.

```html
<doc-note kind="warn" title="One-way migration">
  <p>The backfill cannot be replayed once the old column is dropped.</p>
</doc-note>
```

- **Parts:** `icon`, `title`, `body`

- **See also:** `<doc-blocker>`

### `<doc-blocker>`

Roadblock banner requiring resolution. Contains `<doc-blocks>`, `<doc-why>` and `<doc-action>`.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `severity` | `high` \| `medium` \| `low` | no | Severity: high red (default), medium amber, low gray. |
| `title` | string | **yes** | Short headline of the blocker. |

- `doc-action` is required and the build enforces it. A roadblock with no stated way out is the failure this library exists to prevent.

- For a caveat rather than a blockage, use `doc-note kind="warn"`.

```html
<doc-blocker title="No staging credentials" severity="high">
  <doc-blocks>The vendor webhook cannot be tested end to end.</doc-blocks>
  <doc-why>The shared account was rotated on Friday.</doc-why>
  <doc-action>Ask #platform-eng for a scoped token.</doc-action>
</doc-blocker>
```

- **Parts:** `badge`, `title`, `blocks`, `why`, `action`

- **Requires child:** `<doc-action>`

- **See also:** `<doc-blocks>`, `<doc-why>`, `<doc-action>`, `<doc-note>`

### `<doc-blocks>`

The "What it blocks" line of a `<doc-blocker>`.

- The "what it blocks" line. The label is generated.

```html
<doc-blocks>The vendor webhook cannot be tested end to end.</doc-blocks>
```

- **Parts:** `label`, `content`

- **Only valid inside:** `<doc-blocker>`

- **See also:** `<doc-blocker>`

### `<doc-why>`

The "Why it happened" line of a `<doc-blocker>`.

- The "why it happened" line. Optional.

```html
<doc-why>The shared account was rotated on Friday.</doc-why>
```

- **Parts:** `label`, `content`

- **Only valid inside:** `<doc-blocker>`

- **See also:** `<doc-blocker>`

### `<doc-action>`

The "What unblocks it" line of a `<doc-blocker>`. Required.

- The "what unblocks it" line. Required inside every `doc-blocker`.

```html
<doc-action>Ask #platform-eng for a scoped token.</doc-action>
```

- **Parts:** `label`, `content`

- **Only valid inside:** `<doc-blocker>`

- **See also:** `<doc-blocker>`

### `<doc-list>`

A list with custom markers (check, cross, arrow, dash, bullet, number).

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `marker` | `check` \| `cross` \| `arrow` \| `dot` \| `number` | no | Glyph or counter for items. Defaults to `dot`; `number` is drawn by a CSS counter. |
| `title` | string | no | Optional heading above the list. |
| `kind` | `positive` \| `negative` \| `neutral` | no | Tone of the column inside `doc-compare`. Defaults to `neutral`. |

- Children are plain `<li>`. The glyph is a real text node, so it survives copy-paste and find-in-page.

- `kind` only colours the column when the list sits inside `doc-compare`.

- For an ordinary bulleted list in prose, plain `<ul>` is already styled.

```html
<doc-list marker="check" title="Already built">
  <li>Order ingestion</li>
  <li>Vendor directory</li>
</doc-list>
```

- **Parts:** `title`, `item`, `marker`

- **See also:** `<doc-compare>`, `<doc-checklist>`

### `<doc-quote>`

Pull quote with its own typographic role. The quoted text is the default content.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `cite` | string | no | Attribution line beneath the quote. |

- The quoted text is bare content. `cite` generates the attribution line.

```html
<doc-quote cite="Vendor interview, March 2026">We find out an order landed when the customer calls us.</doc-quote>
```

- **Parts:** `body*`, `cite`

- **See also:** `<doc-note>`

### `<doc-term>`

Inline technical term, hyperlinked. First mention is styled differently from repeats.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `href` | URL | **yes** | Where the term is defined. |

- The first mention is styled differently from repeats. The runtime tracks which is which.

```html
<p>Delivery goes through the <doc-term href="https://example.com/docs/outbox">outbox</doc-term>.</p>
```

- **States:** `:first-mention`

- **Inline element.**

- **See also:** `<doc-ref>`

### `<doc-ref>`

Inline cross-reference. Resolves to the live number at mount, so nothing goes stale when sections shift.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `to` | string | **yes** | Target section title or id (e.g. `sec-what-we-are-building` or `sec-roadmap`). |

- Resolves to the live number at mount, so it cannot go stale when a section moves.

- Never write "see Stage 5". A hardcoded number is a latent bug from the moment something is inserted above it.

```html
<p>Covered in <doc-ref to="sec-data-model"></doc-ref>.</p>
```

- **Inline element.**

- **See also:** `<doc-section>`

## Interactive

_The parts the reader touches. Answers land in the feedback bucket._

### `<doc-choice>`

A decision question with mutually-exclusive or multi-select options.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `id` | slug (`[a-z0-9-]+`) | no | Stable key in the feedback bucket. Derived from `question` if omitted. |
| `question` | string | **yes** | Question text. |
| `mode` | `single` \| `multi` | no | Selection mode: radio (default) or checkbox. |

- The point of the format. Put one wherever you made a judgement call, and mark your suggestion `recommended`.

- Letters, the id, the note field and the ARIA radiogroup are all derived.

- The answer travels back in the feedback bucket carrying the question and label verbatim, so you can read it without the original file.

```html
<doc-choice question="Should read state be shared across the vendor team?" mode="single">
  <doc-option recommended>
    Yes — one shared inbox
    <p slot="desc">Matches how vendors already work the queue.</p>
  </doc-option>
  <doc-option>Per-user, unread counts each</doc-option>
  <doc-option other>Something else</doc-option>
</doc-choice>
```

- **Parts:** `sequence`, `question`, `note-toggle`, `note`, `other`

- **States:** `:answered`, `:note-open`, `:other-open`

- **Requires child:** `<doc-option>`

- **See also:** `<doc-option>`, `<doc-rating>`, `<doc-decision>`

### `<doc-option>`

One answer in a `doc-choice`. Option letters (A, B, C) are derived.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `label` | string | no | Optional label text. |
| `value` | string | no | Optional custom value string. |
| `hint` | string | no | One-line trade-off note beside the label. |
| `recommended` | boolean | no | Option the agent is recommending. |
| `other` | boolean | no | Reveals a free-text input when chosen. Only valid on the last option. |

- The label is the default content; the trade-off goes in `<p slot="desc">`.

- `other` reveals a free-text input and is only valid on the last option.

- Never write the A/B/C letter.

```html
<doc-option recommended>
  Yes — one shared inbox
  <p slot="desc">Why this is the right default.</p>
</doc-option>
```

- **Parts:** `control`, `input`, `key`, `desc`, `recommended`, `other-label`, `other-hint`, `other-text`

- **Only valid inside:** `<doc-choice>`

- **See also:** `<doc-choice>`

### `<doc-rating>`

Interactive rating / scorecard with score options saved directly to feedback bucket.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `id` | slug (`[a-z0-9-]+`) | no | Stable key in the feedback bucket. |
| `question` | string | **yes** | Evaluation question or title. |
| `scale` | integer | no | Highest score on the scale. Clamped to 3–10; defaults to 5. |

- For a magnitude. A choice between named options is `doc-choice`.

- `scale` is clamped to 3–10.

```html
<doc-rating question="How confident are you in this estimate?" scale="5"></doc-rating>
```

- **Parts:** `question`, `scale`, `score-btn`

- **See also:** `<doc-choice>`

### `<doc-checklist>`

Interactive checklist. Items persist check state in the document store.

- Children are plain `<li>`. Check state persists per `doc-id`, so it survives a reload.

- For a static ✓ list that is not meant to be ticked, use `doc-list marker="check"`.

```html
<doc-checklist>
  <li>Schema reviewed</li>
  <li>Runbook updated</li>
</doc-checklist>
```

- **Parts:** `item`, `check`

- **See also:** `<doc-list>`

### `<doc-tabs>`

Tabbed panel switch. Contains one or more `<doc-tab label="...">`.

- For alternatives the reader picks between. Side-by-side comparison is `doc-compare`.

```html
<doc-tabs>
  <doc-tab label="Before" active><p>Today’s flow.</p></doc-tab>
  <doc-tab label="After"><p>The proposed flow.</p></doc-tab>
</doc-tabs>
```

- **Parts:** `strip`, `tab`

- **Requires child:** `<doc-tab>`

- **See also:** `<doc-tab>`, `<doc-compare>`

### `<doc-tab>`

A single tab panel.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `label` | string | **yes** | Tab button text. |
| `active` | boolean | no | Set to make this tab the initially visible one. |

- Without `active` on any tab, the first one opens.

```html
<doc-tab label="Before" active><p>Body.</p></doc-tab>
```

- **Parts:** `body`

- **Only valid inside:** `<doc-tabs>`

- **See also:** `<doc-tabs>`

### `<doc-collapse>`

Generic disclosure. Use `doc-stage` instead when the sections form a numbered sequence (§8.5).

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | **yes** | Summary text on the toggle. |
| `open` | boolean | no | Starts expanded. |
| `sticky` | boolean | no | Remembers the reader's choice in the store, so it outlives a reload. Without it `open` wins on every load. |

- For detail that would otherwise bury the argument.

- `sticky` remembers the reader’s choice across reloads; without it the `open` attribute wins on every load.

```html
<doc-collapse title="Full migration SQL" sticky>
  <doc-code lang="sql">alter table orders add column notified_at timestamptz;</doc-code>
</doc-collapse>
```

- **Parts:** `summary`, `chevron`, `summary-text`, `body*`

- **States:** `:open`

- **See also:** `<doc-stage>`, `<doc-section>`

### `<doc-carousel>`

Interactive slide viewer / gallery container with non-destructive slide toggling.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | no | Optional title banner for the gallery. |

- Slides are the direct children. Hiding a slide never removes it from the DOM.

```html
<doc-carousel title="Screens">
  <doc-figure type="image" src="./one.png" caption="Inbox"></doc-figure>
  <doc-figure type="image" src="./two.png" caption="Detail"></doc-figure>
</doc-carousel>
```

- **Parts:** `controls`, `prev-btn`, `next-btn`, `prev-icon`, `next-icon`, `dots`, `dot`

- **See also:** `<doc-figure>`

## Structure

_Sequences and phases._

### `<doc-flow>`

Horizontal sequence flow. Nodes connect with arrows; wrap automatically.

- A short linear pipeline, laid out in the document’s own type. Arrows and wrapping are automatic.

- Anything that branches or loops wants `doc-figure type="mermaid"`.

```html
<doc-flow>
  <doc-flow-node title="Order lands">webhook</doc-flow-node>
  <doc-flow-node title="Outbox" active>durable</doc-flow-node>
  <doc-flow-node title="Vendor notified">email</doc-flow-node>
</doc-flow>
```

- **Parts:** `arrow`, `arrow-icon`

- **Requires child:** `<doc-flow-node>`

- **See also:** `<doc-flow-node>`, `<doc-figure>`

### `<doc-flow-node>`

One step in a `<doc-flow>`.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | **yes** | Node label. |
| `active` | boolean | no | Highlights the current or recommended path. |

- The child text is the subtitle. `active` marks the current or recommended path.

```html
<doc-flow-node title="Outbox" active>durable</doc-flow-node>
```

- **Parts:** `title`, `subtitle*`

- **States:** `:active`

- **Only valid inside:** `<doc-flow>`

- **See also:** `<doc-flow>`

### `<doc-roadmap>`

Delivery phases with numbers, subtitles, and expandable content.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `start` | integer | no | Number assigned to the first stage (0 or 1). Default 1. |

- Delivery phases with bodies. Dated events are `doc-timeline`.

```html
<doc-roadmap start="1">
  <doc-stage title="Ingestion" subtitle="2 weeks" current open>
    <p>What lands in this phase.</p>
  </doc-stage>
  <doc-stage title="Notification" subtitle="3 weeks"><p>Next.</p></doc-stage>
</doc-roadmap>
```

- **Requires child:** `<doc-stage>`

- **See also:** `<doc-stage>`, `<doc-timeline>`

### `<doc-stage>`

One phase in a roadmap. Derives its anchor id and badge number.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | **yes** | Stage name. |
| `subtitle` | string | no | One-line status or timing beside the title. |
| `current` | boolean | no | Highlights the active phase with an accent border. |
| `open` | boolean | no | Expands the stage body on load. |

- The badge number and the anchor id are derived. Reference it with `doc-ref`, never by typing the number.

```html
<doc-stage title="Ingestion" subtitle="2 weeks" current open><p>Body.</p></doc-stage>
```

- **Parts:** `header`, `badge`, `heading`, `title`, `subtitle`, `current-marker`, `body`

- **States:** `:open`, `:current`

- **Only valid inside:** `<doc-roadmap>`

- **See also:** `<doc-roadmap>`, `<doc-ref>`

## Content

_Code, diagrams, tables and trees._

### `<doc-code>`

Syntax-highlighted code block with line numbers, copy button, and highlight ranges.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `lang` | `ts` \| `js` \| `tsx` \| `jsx` \| `html` \| `css` \| `json` \| `bash` \| `sh` \| `sql` \| `rust` \| `python` \| `yaml` \| `toml` \| `diff` \| `http` \| `text` | **yes** | Language for syntax highlighting. Required. |
| `title` | string | no | Filename or label in the header bar. |
| `highlight` | string | no | Line numbers or ranges to highlight (e.g. `3`, `5-8`, `3, 5-8`). |
| `wrap` | boolean | no | Soft-wrap long lines instead of scrolling them horizontally. |

- `lang` is required, and a language outside the allowlist is a build error rather than a silent fallback to plain text.

- Line numbers, the copy button and the highlight overlay are generated. Escape `<` as `&lt;` in the body.

```html
<doc-code lang="ts" title="src/outbox.ts" highlight="2-3">
export async function enqueue(order: Order) {
  await db.insert(outbox).values({ orderId: order.id });
  return { queued: true };
}
</doc-code>
```

- **Parts:** `header`, `title`, `lang`, `copy`, `code`, `gutter`, `line-number`, `lines`, `line`, `feedback`

- **See also:** `<doc-diff>`

### `<doc-diff>`

Unified diff viewer with additions and deletions highlighted.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `lang` | `ts` \| `js` \| `tsx` \| `jsx` \| `html` \| `css` \| `json` \| `bash` \| `sh` \| `sql` \| `rust` \| `python` \| `yaml` \| `toml` \| `diff` \| `http` \| `text` | no | Syntax highlighting language for diff lines. |
| `filename` | string | no | File path displayed in the header. |

- A unified diff body. The +/- counts in the header are derived.

```html
<doc-diff lang="ts" filename="src/outbox.ts">
-  await send(order);
+  await enqueue(order);
</doc-diff>
```

- **Parts:** `header`, `filename`, `stat-add`, `stat-remove`, `code`, `row`, `old-number`, `new-number`, `sign`, `text`, `feedback`

- **See also:** `<doc-code>`

### `<doc-figure>`

Diagram or illustration container with Mermaid rendering and caption.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `type` | `svg` \| `image` \| `mermaid` \| `html` | no | Figure type. Defaults to `svg`. `html` renders inside a sandboxed `<iframe srcdoc>`. |
| `caption` | string | no | Figure caption beneath the illustration. |
| `src` | URL | no | Image URL for `type="image"`. |
| `alt` | string | no | Accessible description for screen readers. |

- Prefer `type="mermaid"` over hand-drawn SVG: five lines replaces hundreds of hand-placed coordinates, and it renders in the document’s own colours.

- `type="html"` renders inside a sandboxed `<iframe srcdoc>`, never inline.

- Mermaid is only embedded by `--offline` builds, and it is most of their weight.

```html
<doc-figure type="mermaid" caption="How a plan travels from the agent to the reader and back">
flowchart LR
  A[Agent] --> B[Document] --> C[Reader] --> D[Bucket] --> A
</doc-figure>
```

- **Parts:** `content`, `caption`, `diagram-error`, `feedback`

- **See also:** `<doc-caption>`, `<doc-flow>`

### `<doc-caption>`

Rich figure caption containing formatted prose, links or terms.

- Only needed when the caption contains links, terms or refs. Otherwise use `caption`.

```html
<doc-figure type="mermaid">
flowchart LR
  A --> B
  <doc-caption>See <doc-ref to="sec-data-model"></doc-ref> for the schema.</doc-caption>
</doc-figure>
```

- **Only valid inside:** `<doc-figure>`

- **See also:** `<doc-figure>`

### `<doc-table>`

Wraps a plain `<table>`. Adds a scroll port and, below 1050px, stacks rows into label/value cards.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `size` | `sm` \| `md` | no | Cell padding and type size. Defaults to `md`. |
| `stack` | `auto` \| `never` | no | Whether narrow viewports restack rows as cards (§8.3). Defaults to `auto`. |

- You write the `<table>` yourself — the component only enhances it, and never reparents it.

- The stacked cards take their labels from the `<thead>` text. `stack="never"` opts out of both the restacking and the labelling.

```html
<doc-table size="sm">
  <table>
    <thead><tr><th>Field</th><th>Type</th></tr></thead>
    <tbody><tr><td>notified_at</td><td>timestamptz</td></tr></tbody>
  </table>
</doc-table>
```

- **Parts:** `table`, `scroll-hint`

- **See also:** `<doc-matrix>`, `<doc-compare>`

### `<doc-tree>`

Directory tree viewer with ASCII connector lines and folder icons.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `root` | string | no | Root folder name displayed at top of tree. |

- Connector lines and folder icons are generated from nested `<ul>`/`<li>`.

```html
<doc-tree root="src/">
  <li>core/
    <ul><li>contract.ts</li></ul>
  </li>
  <li>index.ts</li>
</doc-tree>
```

- **Parts:** `list`, `node`, `connector`, `label`, `feedback`

### `<doc-compare>`

Side-by-side or column comparison container for options, pros/cons, before/after.

| Attribute | Values | Required | Notes |
| --- | --- | --- | --- |
| `columns` | `2` \| `3` \| `4` | no | Number of comparison columns. Default 2. |

- Columns are `doc-list` blocks with a `title`. Collapses to one column on a narrow viewport.

```html
<doc-compare columns="2">
  <doc-list kind="positive" marker="check" title="Outbox"><li>Survives a restart</li></doc-list>
  <doc-list kind="negative" marker="cross" title="Direct send"><li>Lost on deploy</li></doc-list>
</doc-compare>
```

- **Parts:** `column`

- **See also:** `<doc-list>`, `<doc-tabs>`

## Code language allowlist

A `lang` outside this list is a build **error**, never a silent fallback to
plain text. Extending it is a one-line change in `src/core/contract.ts` plus an
import in `src/vendor/highlight.ts`, then a rebuild.

| Language | Values |
| --- | --- |
| `ts` | Supported |
| `js` | Supported |
| `tsx` | Supported |
| `jsx` | Supported |
| `html` | Supported |
| `css` | Supported |
| `json` | Supported |
| `bash` | Supported |
| `sh` | Supported |
| `sql` | Supported |
| `rust` | Supported |
| `python` | Supported |
| `yaml` | Supported |
| `toml` | Supported |
| `diff` | Supported |
| `http` | Supported |
| `text` | Supported |
