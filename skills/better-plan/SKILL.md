---
name: better-plan
description: Write interactive planning documents or documentation as ForgeDoc markup, build them to a single self-contained HTML file, and read a pasted feedback bucket back. Use whenever you are asked to plan work, write a design doc, propose an approach, write documentation, or collect decisions from a human reviewer.
---

# ForgeDoc

You write **semantic markup only**. A prebuilt runtime supplies all styling,
layout, interactivity, persistence and feedback collection.

Do not write `<style>`, `<script>`, `class=`, `id=`, `role=`, `aria-*`, option
letters (`A`/`B`/`C`), section numbers (`1.2.1`), or stage numbers. Every one of
those is derived. Writing them by hand either fails the build or goes stale.

Read `CHEATSHEET.md` for the full tag list. It fits on one page; keep it open.
`REFERENCE.md`, beside it, is the per-attribute detail — reach for it only when
the cheatsheet leaves a question open.

## File naming convention

- **`PLAN_<name>.html`**: Use for interactive plans, implementation roadmaps, approach proposals, and decision-gathering documents.
- **`DOC_<name>.html`**: Use for general documentation, technical specifications, guides, and design docs.

## Producing a document

1. `forgedoc new <name>` — or write the skeleton yourself in `PLAN_<name>.html` or `DOC_<name>.html`. It must contain these
   two lines, byte for byte: the first in `<head>`, the second as the last line
   of `<body>`.

   ```html
   <style>/*@DOC_CSS@*/</style>
   <script>//@DOC_JS@</script>
   ```

   The styles go up top so the reader never sees a frame of unstyled markup;
   the script goes last so every element upgrades with its children present.

   If the user asked for a particular theme, name it in that first line —
   `<style>/*@DOC_CSS:geist@*/</style>`. The build then compiles that theme in.
   Leave it bare unless they asked; the default is `forgedoc`. Run
   `forgedoc build --theme wrong` to see the list of themes that exist.

2. Write the document inside a single `<doc-page doc-id="a-unique-slug">`.
   The `doc-id` is mandatory — it namespaces the reader's stored answers, and
   without it two plans opened from disk can overwrite each other.

3. `forgedoc build <file.html> [--out <target.html>]`

   The build validates first and writes nothing if validation fails. By default,
   `forgedoc build PLAN_<name>.html` outputs `PLAN_<name>.built.html` (or `DOC_<name>.built.html`).
   If you want a specific output filename, pass `--out <target.html>`.

   The output links a version-pinned CDN and stays around 15 kB, so it is safe
   to commit. Pass `--offline` only when the reader genuinely has no network —
   it embeds the whole runtime, which is ~3.5 MB once a Mermaid figure is
   present, and writes into `.temp/` because that file should never be
   committed.

## Lifecycle and revisions

- **Default lifecycle (in-place override):** Maintain a single source file (`PLAN_<name>.html` or `DOC_<name>.html`). On every revision, edit the original source file directly in-place and rebuild. If a build creates a new output file or renames output, clean up any stray or obsolete files so you keep only the clean single document. Do not create unnecessary intermediate files (e.g. `PLAN_<name>.something.html` or `PLAN_<name>.v1.html`) by default.
- **Explicit output naming:** You can explicitly provide the desired output filename using `--out <target.html>`.
- **Numbered/versioned lifecycle:** Only create versioned files (`PLAN_<name>.v1.html`, `DOC_<name>.v1.html`, etc.) if the user explicitly asks for versioning, a numbered lifecycle, or versioned revisions.

## What the runtime derives, so you never type it

| You write                                | The runtime produces                                                                                                              |
|------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `<doc-section title="Data model">`       | The number `2.1`, the id `sec-data-model`, the heading element, the TOC entry                                                     |
| `<doc-choice question="…">` with options | Letters `A`/`B`/`C`, an "Other" option with a textarea, a note field, `QUESTION 3 · SINGLE CHOICE`, the id `q-…`, radiogroup ARIA |
| `<doc-stage title="…">`                  | The stage number, starting at 0                                                                                                   |
| `<doc-ref to="sec-data-model">`          | The live text "Section 2.1"                                                                                                       |
| `<doc-term href="…">`                    | First-mention styling, distinct from repeats                                                                                      |

## Writing well

- **Use elements only when necessary.** Do not use any element just to use it. Only use elements if they are necessary for the document.
- **Ask real questions when needed.** Put a `doc-choice` wherever you made a judgement call or need a decision from the reader, and mark your suggestion `recommended`.
- **Every roadblock states its resolution.** `doc-blocker` requires a
  `doc-action`. This is enforced, not advisory — a roadblock with no way out is
  the failure the whole library exists to prevent.
- **Prefer `doc-figure type="mermaid"` over hand-drawn SVG.** Five lines of
  Mermaid replaces a few hundred lines of hand-placed coordinates, renders in the
  document's own colours, and is far more reliable to write.
- **Use `doc-ref`, never "see Stage 5".** Numbering is automatic; a hardcoded
  reference is a latent bug from the moment a stage is inserted above it.
- **Use plain HTML for prose.** `<p> <ul> <ol> <li> <code> <a> <strong> <em>` are
  all styled. There is deliberately no tag for them.
- **Presets, not CSS.** `<doc-page density="compact" measure="wide">` is
  validated and consistent; hand-written CSS is not.

## Reading a pasted bucket back

A reader sends you a block that begins `=== FB v1 ·`. It is self-contained: it
carries the question text and the chosen option labels verbatim, so you do not
need the original file to interpret it.

```text
=== FB v1 · vendor-orders · 2026-07-28T10:22:31Z · 2 items ===

[1] ANSWER q-should-read-state-be-shared
q: Should read state be shared across the vendor team?
a: Yes — shared team inbox
n: only if we can still see who marked it read

[2] COMMENT sec-what-we-are-building
at: 1 What we are building
> Vendors get told the moment a new order lands
c: is this the payment webhook or the order row?

=== end FB v1 ===
```

Fields: `q:` question, `a:` a chosen answer label (repeated for a multi answer),
`n:` a note _about_ the answer, `>` the quoted excerpt, `c:` the reader's
comment, `at:` where in the document. A field's continuation lines are indented
by exactly three spaces.

A comment on a diagram, an image or a code block has no selectable text to
quote, so its `>` line is a descriptor instead — `> doc-figure · How a plan
travels from the agent to the reader and back`. The anchor id is generated
(`blk-figure-2`), so resolve it by the caption or filename in that descriptor,
not by the id.

### Receipt rules — follow these exactly

1. **Resolve each item by anchor id first, quoted text second.** The anchor id is
   the token after `ANSWER` or `COMMENT`.
2. **The option label is authoritative over the option key.** If the label and
   the key disagree, or the anchor no longer exists in your copy of the document,
   **ask the reader**. Never guess which option they meant.
3. **A malformed item invalidates only itself.** Process every other item and
   report the broken one back to the reader.
4. **Never attribute an answer to a question whose text does not match
   verbatim.** If the question was reworded between the version they answered and
   the version you are holding, that is a question to ask, not a match to make.
5. **An `a:` line under an Other answer is the reader's own words**, not one of
   your option labels. Treat it as a new proposal.

### After you have read it

Update the plan with the decisions folded in. Answered questions become
`<doc-chip kind="confirmed">` entries rather than open `doc-choice` blocks — a
question the reader has already settled should not be asked twice. Tooling can do
this incrementally with `ForgeDoc.chips.add({kind: 'confirmed', text: '…'})`.

## Budget

A plan of the size of the reference document should cost **under 4,000 output
tokens** of markup. If you find yourself writing layout, colours, or numbers, you
are writing something the runtime already does.
