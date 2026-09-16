# ForgeDoc

**A web component library for AI-authored interactive planning documents.**

An AI coding agent asked to plan work usually emits Markdown, which renders
poorly and cannot be answered. The alternative — having the agent hand-write
bespoke HTML, CSS and JS every time — burns thousands of output tokens per plan
and drifts from the intended design on every run.

ForgeDoc ships the runtime once. The agent writes **only semantic markup**:

```html
<style>/*@DOC_CSS@*/</style>   <!-- in <head>: styles land before the markup -->

<doc-page doc-id="vendor-orders" density="comfortable" accent="teal">
  <doc-header kicker="Plan · Vendor dashboard">
    Vendor orders experience
    <p slot="lede">Vendors get told the moment a new order lands.</p>
  </doc-header>

  <doc-section title="What we are building">
    <p>One feature, three faces…</p>
  </doc-section>

  <doc-choice mode="single" question="Should read state be shared?">
    <doc-option recommended>Yes — shared team inbox</doc-option>
    <doc-option>No — per-person read state</doc-option>
  </doc-choice>
</doc-page>

<script>//@DOC_JS@</script>    <!-- last line of <body> -->
```

No `<style>`, no `<script>`, no class names, no ids, no `A`/`B`/`C` option keys,
no `1.2.1` section numbers. Every one of those is derived by the runtime — along
with layout, dark mode, persistence, and a feedback bucket the reader can paste
straight back to the agent.

```sh
forgedoc build DOC_vendor-orders.html
```

The build rewrites that same file: one `.html` of about 15 kB, linking a
version-pinned CDN. Small enough to commit, review in a diff, and open anywhere.
There is no second artefact to keep in step — revise the document and build it
again, and the build reads its own output.

Add `--offline` when the document has to survive with no network at all, and
`--history` when past versions should be kept beside the current one.

---

## Install

### The usual path

```sh
npm install -g forgedoc
forgedoc new vendor-orders          # scaffold
forgedoc build DOC_vendor-orders.html
```

### Offline

```sh
forgedoc build DOC_vendor-orders.html --offline
```

Embeds the entire runtime, Mermaid included, so the document opens from
`file://` on a machine with no network. It is a build artefact, not a source
file: it writes into `.temp/` by default, and you should gitignore that rather
than commit a multi-megabyte HTML file.

### Direct from a CDN

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/forgedoc@2.1.0/dist/forgedoc.css" />
<script defer src="https://cdn.jsdelivr.net/npm/forgedoc@2.1.0/dist/forgedoc.iife.js"></script>
```

Pin the exact version, never `@1` or `@latest`. A pinned path is served
`immutable`, so a reader who opens a second plan pays nothing for the runtime —
and a plan published today keeps rendering against the runtime it was checked
against.

`defer` matters. Elements are defined after the document is parsed, so every
element upgrades once, synchronously, with all of its children present.

### npm, for tooling

```js
import { parseBucket, TAGS } from 'forgedoc';
import 'forgedoc/style.css';
```

## The agent skills

The markup is meant to be written by an agent, so the instructions for writing it
ship as installable skills. One command, no clone, no copy-paste:

```sh
npx skills add naz-ovh/forgedoc
```

That installs both skills into whichever agents you pick — Claude Code, Codex,
Cursor, Copilot, opencode, Amp, Antigravity, Windsurf. Add `-g` to install them
once for every project on the machine instead of just this one.

| Skill | Use it for |
| --- | --- |
| `better-plan` | Planning documents, design docs, proposals — anything that asks the reader to decide something, and reads their answers back. |
| `better-docs` | Reader-facing documentation: guides, tutorials, references, runbooks, ADRs, onboarding. |

Both need the `forgedoc` binary on PATH to build what they write:

```sh
npm install -g forgedoc
```

## Docs

|                                                              |                                                                                  |
|--------------------------------------------------------------|----------------------------------------------------------------------------------|
| [`skills/better-plan/SKILL.md`](skills/better-plan/SKILL.md) | The planning skill. Loads FEEDBACK.md and BUILDING.md only when needed.          |
| [`skills/better-plan/`](skills/better-plan/)                 | Its lazily-read companions: the cheatsheet, reading answers back, build options. |
| [`skills/better-docs/SKILL.md`](skills/better-docs/SKILL.md) | The documentation skill.                                                         |
| [`docs/CHEATSHEET.md`](docs/CHEATSHEET.md)                   | The whole vocabulary on one page. Generated; `forgedoc cheatsheet` prints it.    |
| [`docs/REFERENCE.md`](docs/REFERENCE.md)                     | Full per-component API. Generated; `forgedoc reference` prints it.               |
| [`docs/GEIST.md`](docs/GEIST.md)                             | The Geist theme: what it changes and how it embeds its fonts.                    |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                     | Open questions, flagged deviations, dependency justifications.                   |

## Themes

A document ships exactly one stylesheet, so the theme is chosen at **build**
time, never swapped at runtime.

| Theme | |
| --- | --- |
| `default` | What you get when you ask for nothing. Vendors Plus Jakarta Sans and JetBrains Mono. |
| `geist` | Tighter, more technical. Vendors Geist Sans and Geist Mono — see [`docs/GEIST.md`](docs/GEIST.md). |
| `bun` | High-contrast, heavier display type. |
| `forgedoc` | The original teal editorial look, and the reference the other themes are checked against. |

```sh
forgedoc build DOC_plan.html --theme geist
forgedoc themes                            # what this installation can build with
```

The document can also name its own theme, so the choice travels with the source
rather than with the command that built it:

```html
<style>/*@DOC_CSS:geist@*/</style>
```

A theme that vendors typefaces embeds them in its stylesheet, so `--offline`
documents keep their fonts on a machine that has never seen them.

## CLI

```text
forgedoc build <file.html> [--history] [--offline] [--theme <name>] [--out <file>] [--no-validate]
forgedoc validate <file.html> [--format=json] [--built]
forgedoc new <name> [--dir <path>]
forgedoc themes [--format=json]
forgedoc cheatsheet | elements | info <element> | search <words> | reference
forgedoc version
```

`build` rewrites the document in place and validates first, writing nothing if
validation fails. Every finding carries a file, line, column, rule id and a
concrete fix, so an agent can close its own loop: write → build → read errors →
fix → rebuild.

`--history` moves the document into a folder of its own, where `index.html` is
the current plan and `history/` keeps each published version. `--offline` writes
into `.temp/` instead, because a 3.5 MB embedded document is something you send,
not something you commit.

## How it is put together

Five constraints shape everything. They are documented in full in `docs/PLAN.md`; the
short version:

1. **Light DOM only.** Not one `attachShadow` call, enforced by a lint rule and a
   repository check. The feedback bucket lets a reader select arbitrary text
   anywhere in the document — or press **Comment** on a diagram, image or code
   block, which have no text to select — and selection APIs do not cross shadow
   boundaries cleanly. Find-in-page and print-to-PDF would degrade too.
2. **Enhance in place.** Components read the DOM the agent wrote, append chrome
   _around_ it, and wire behaviour. They never move an author node.
3. **`--offline` works from `file://` with no network.** That bundle is IIFE,
   carries Mermaid, and reaches for nothing. The default build links a pinned
   CDN instead, because a plan is text and belongs in git as text.
4. **Zero generation tokens for the runtime.** It is injected post-generation by
   replacing two placeholders.
5. **No component framework for the elements.** Plain `HTMLElement` subclasses.
   Svelte is used for exactly one thing — the feedback panel — because all of its
   DOM is runtime-created and none of it is author content.

## Development

```sh
npm install
npx playwright install chromium

npm run dev              # QA page: tests/fixtures/kitchen-sink.html
npm test                 # browser tests (real Chromium) + Node tests
npm run test:visual      # browser e2e: offline, CDN and themed builds
npm run check            # format, lint, typecheck, build, test
```

`npm test` runs two projects. The browser project uses **real Chromium** via
Playwright — jsdom and happy-dom implement neither `ElementInternals`,
`CustomStateSet`, nor the CSS Custom Highlight API, all of which are load-bearing
here, so a green suite under either would be meaningless. The Node project covers
the validator, which parses raw HTML with parse5 and never imports the browser
runtime.

### Browser end-to-end suite

`npm run test:visual` drives the artefacts as delivered: the offline `file://`
document, a CDN-linked document, and a Geist build with its fonts embedded. It
asserts what they _do_ — elements upgrade, answers persist across a reload, the
feedback block round-trips, no network request escapes an offline build.

**It does not test appearance.** There are no screenshots and no computed-style
assertions anywhere in the suite. Styling changes often and on purpose, so a
test that fails when a colour, a margin or a breakpoint moves reports a decision
as a defect. Themes are checked by looking at them — see the next section.

### Previewing a theme

```sh
npm run build      # dist/themes/<name>.css
npm run preview    # .temp/preview-<name>.html, one per theme
```

Each preview is the kitchen sink built as a reader receives it — one file, no
server, and the feedback bucket persists to localStorage so you can leave
comments in it. Open two side by side to compare themes.

The dev server (`npm run dev`) can only ever show one theme, because
`src/index.ts` imports exactly one — the default.

### Adding a theme

1. `cp -r src/styles/themes/forgedoc src/styles/themes/<name>` — copy the
   _reference_ theme, whichever one is currently the default. The copy is the
   visual layer; `src/styles/base/` is shared and must not be touched.
2. Retune `_tokens.scss` and `_presets.scss`. Most of a theme is these two.
3. Adjust only the `components/*.scss` that genuinely differ in shape rather
   than in colour. They land in `@layer doc.theme`, after `doc.components`, so
   an override needs no `!important` and no selector matching.
4. `npm run lint` — fails if the theme is missing a token the reference declares.
5. `npm run preview` and look at it in both colour schemes.

### Adding a component

1. `src/core/contract.ts` — the tag, its attributes, its doc strings.
2. `src/components/<tag>.ts` — one file, named exactly after the tag.
3. `src/styles/base/components/_<name>.scss` — structure only, inside
   `@layer doc.components`. Then `src/styles/themes/forgedoc/components/_<name>.scss`
   for everything visual, inside `@layer doc.theme`. `npm run lint` fails if a
   colour, size, spacing or typography property lands in the base half.
   Add both to the matching `index.scss`.
4. `src/index.ts` — register it.
5. `tests/fixtures/kitchen-sink.html` — `npm test` fails if you skip this.
6. `npm run docs:generate` — `npm test` fails if you skip this too.

## Licence

MIT
