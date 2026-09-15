---
name: better-docs
description: Write or revise clear, polished documentation as ForgeDoc markup, preferring predefined doc-* elements and using native or custom HTML only when the vocabulary has no suitable component. Use for guides, tutorials, references, runbooks, specifications, ADRs, onboarding material, and other reader-facing documentation.
---

# Better docs with ForgeDoc

Create documentation that is easy to scan, trustworthy, task-oriented, and
open to inline reader feedback. ForgeDoc supplies the visual system,
interactivity, persistence, and feedback bucket; concentrate on the document's
meaning and evidence.

## Choose markup in this order

1. **Use a predefined `doc-*` element** when one represents the content's
   meaning. This is the default, even when custom HTML would be shorter.
2. **Use native semantic HTML** for ordinary prose and structures that do not
   need a ForgeDoc component: `p`, `ul`, `ol`, `li`, `strong`, `em`, `a`,
   `code`, `kbd`, `abbr`, `dl`, and similar elements.
3. **Use custom HTML only as a semantic gap filler** when neither ForgeDoc nor
   native HTML can express an important structure. It is not a styling escape
   hatch.

Never rebuild a predefined component with `div`, `details`, a hand-made card,
or a custom table. Do not choose custom markup merely to make one section look
different. If a predefined element expresses the meaning without
misrepresenting it, use that element.

Common mappings:

| Content | Prefer |
| --- | --- |
| Page, introduction, navigable section | `doc-page`, `doc-header`, `doc-section` |
| Procedure or ordered work | `doc-steps` and `doc-step` |
| Caveat, tip, warning, or status | `doc-note`, `doc-badge`, `doc-chips` |
| Code, patch, hierarchy, or tabular data | `doc-code`, `doc-diff`, `doc-tree`, `doc-table` |
| Diagram, image, or rich caption | `doc-figure` and `doc-caption` |
| Alternatives or comparison | `doc-compare`, `doc-matrix`, or `doc-tabs` |
| Recorded decision | `doc-decision` |
| Genuine unresolved decision | `doc-choice` |
| API operation and parameters | `doc-endpoint`, `doc-params`, `doc-param` |
| Optional secondary detail | `doc-collapse` |

Use `doc-tabs` only for parallel alternatives or views, not as general page
navigation. Use `doc-collapse` only for material a reader can safely skip.
Ordinary bullets remain a native `ul`; use `doc-list` when its marker carries
meaning such as success, failure, or action.

## Look up the vocabulary instead of guessing

Start with `forgedoc cheatsheet`. Use `forgedoc search <words>` when the right
element is unclear and `forgedoc info <element>` before using an unfamiliar
component. Use `forgedoc reference` for the complete contract. These commands
accept `--format=json`.

Run them as `npx forgedoc <command>` when the binary is not on PATH. Never
invent a `doc-*` tag or attribute.

## Write the document

Name the editable source `DOC_<name>.html`. It must contain these placeholders
exactly, with the style in `head` and the script as the last line of `body`:

```html
<style>/*@DOC_CSS@*/</style>
<script>//@DOC_JS@</script>
```

Put the content inside exactly one page with a stable, unique slug:

```html
<doc-page doc-id="cache-invalidation-guide" accent="teal">
  <doc-header kicker="Engineering guide">
    Cache invalidation
    <p slot="lede">Choose and verify the correct invalidation path.</p>
  </doc-header>
  <doc-section title="Quick start">
    <p>Begin with the smallest safe operation.</p>
  </doc-section>
</doc-page>
```

Let ForgeDoc derive the table of contents, anchors, numbering, option letters,
ARIA, and component chrome. Do not author `doc-toc`, section numbers, stage
numbers, option letters, `role`, or `aria-*`. Let titles and questions derive
ids; add an explicit `id` only when an external stable link requires one.

For custom markup:

- Prefer semantic native elements over generic containers.
- Keep it minimal and accessible: preserve heading order, label controls, give
  images useful alt text, and give data tables header cells.
- Use ForgeDoc presets and elements before adding presentation hooks.
- If styling is truly necessary, use ForgeDoc token overrides first, then the
  smallest scoped rule. Target only documented `data-part` values on ForgeDoc
  elements; internal classes are not API.
- Do not add authored JavaScript unless the user explicitly requires behavior
  the runtime cannot provide. A custom interaction must remain keyboard usable
  and must not break selection-based feedback.

## Guardrails against typical LLM documentation failures

### Be specific, not generic

- Write for the stated reader and their immediate goal. If no audience is
  stated, infer it from the request and repository, then keep that assumption
  consistent.
- Lead with what the reader will accomplish, not a broad history or claims such
  as “in today's fast-paced world.”
- Replace praise and vague adjectives with observable facts, constraints, and
  examples. Do not call something simple, seamless, robust, or powerful unless
  the document proves the relevant property.
- Match the document type. A tutorial teaches one successful path; a how-to
  solves a task; a reference describes a contract; an explanation builds a
  mental model; a runbook includes detection, recovery, and escalation.

### Control verbosity and structure

- Give each section one job. Merge overlapping sections and remove any summary
  that merely repeats the preceding text.
- Prefer coherent paragraphs for explanation. Use lists only for genuinely
  parallel items and tables only when readers need row-by-row comparison.
- Do not turn every paragraph into a heading, note, card, tab, or callout.
  Visual emphasis is scarce; reserve it for information with a distinct role.
- Keep examples as small as possible while still runnable or representative.
  Do not repeat a whole file to explain a few changed lines.

### Protect factual integrity

- Ground claims in the user's material, the repository, executed checks, or
  verified sources. Never invent APIs, commands, configuration keys, version
  behavior, benchmarks, quotations, links, or citations.
- Distinguish current behavior, recommendation, assumption, and unresolved
  question. Use `doc-decision` for a settled decision and `doc-choice` only for
  a decision a reader can actually make.
- Do not ask the reader to decide a fact that can be inspected or researched.
  Investigate it first. When evidence is unavailable, narrow or label the claim
  instead of filling the gap with plausible prose.
- Preserve important limitations and negative cases. Never hide uncertainty in
  confident wording.

### Make instructions executable

- State prerequisites before the first irreversible or failure-prone step.
- For procedures, include the action, the expected result, and what to check if
  the result differs. Add rollback or escalation guidance when failure has a
  meaningful cost.
- Use exact commands and paths that match the target environment. Mark code
  languages, define placeholders, and distinguish copyable input from sample
  output.
- Keep terminology, names, casing, and examples consistent from beginning to
  end. Define unfamiliar terms on first use.
- Link with descriptive text rather than “click here.” Do not rely on color,
  position, or an unlabeled icon as the only carrier of meaning.

## Feedback and decisions

Readers can select any text and attach a comment, so do not add a question just
to make the document interactive. Add `doc-choice` only for a real unresolved
decision, mark the best-supported option `recommended`, and make tradeoffs
explicit. A no-choice validator warning is acceptable for ordinary
documentation.

When the user pastes a block beginning `=== FB v1 ·`, apply every unambiguous
comment to the source and rebuild. Resolve by anchor first and quoted text
second. Never guess when an option label, question text, or target no longer
matches; report the ambiguous item while still processing the others.

## Validate before handing off

Run:

```sh
forgedoc validate DOC_<name>.html --format=json
forgedoc build DOC_<name>.html
```

Then review the built document for a clear first screen, correct heading order,
working links, readable examples, useful alternative text, and absence of
unsupported claims or duplicated conclusions. Keep the editable source and the
built output; do not create versioned or intermediate files unless the user
asked for them.
