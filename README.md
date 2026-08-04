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

One `.html` of about 15 kB, linking a version-pinned CDN. Small enough to commit,
review in a diff, and open anywhere.

Add `--offline` when the document has to survive with no network at all.

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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/forgedoc@1.0.0/dist/forgedoc.css" />
<script defer src="https://cdn.jsdelivr.net/npm/forgedoc@1.0.0/dist/forgedoc.iife.js"></script>
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

## The agent skill

The markup is meant to be written by an agent, so the instructions for writing it
ship as an installable skill. One command, no clone, no copy-paste:

```sh
npx skills add MrBns/plankit
```

That installs the `better-plan` skill into whichever agents you pick — Claude Code, Codex,
Cursor, Copilot, opencode, Amp, Antigravity, Windsurf. Add `-g` to install it once
for every project on the machine instead of just this one.

The skill still needs the `forgedoc` binary on PATH to build what it writes:

```sh
npm install -g forgedoc
```

## Docs

|                                                                        |                                                                             |
|------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| [`skills/better-plan/SKILL.md`](skills/better-plan/SKILL.md)           | The skill itself, including the rules for reading a pasted feedback bucket. |
| [`skills/better-plan/CHEATSHEET.md`](skills/better-plan/CHEATSHEET.md) | One page. The authoring agent's primary reference.                          |
| [`skills/better-plan/REFERENCE.md`](skills/better-plan/REFERENCE.md)   | Full per-component API. Generated from the contract.                        |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                               | Open questions, flagged deviations, dependency justifications.              |

## CLI

```text
forgedoc build <file.html> [--out <file>] [--offline] [--no-validate]
forgedoc validate <file.html> [--format=json] [--built]
forgedoc new <name> [--dir <path>]
forgedoc version
```

`build` validates first and writes nothing if validation fails. Every finding
carries a file, line, column, rule id and a concrete fix, so an agent can close
its own loop: write → build → read errors → fix → rebuild.

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
npm run test:visual      # visual regression
npm run check            # format, lint, typecheck, build, test
```

`npm test` runs two projects. The browser project uses **real Chromium** via
Playwright — jsdom and happy-dom implement neither `ElementInternals`,
`CustomStateSet`, nor the CSS Custom Highlight API, all of which are load-bearing
here, so a green suite under either would be meaningless. The Node project covers
the validator, which parses raw HTML with parse5 and never imports the browser
runtime.

### Visual regression

The suite has two halves.

`npm run test:visual:ci` runs the deterministic half — reading-column centring at
four widths, TOC docking geometry, the collapsed-panel size rule, the print
rules, and the whole offline `file://` document. No baselines, no binaries, so
it runs anywhere.

`npm run test:visual` adds the `@pixel` tests, which compare full-page
screenshots at 390 / 768 / 1280 / 2560 in both colour schemes, plus print.
**Those baselines are generated, so they are not stored in the repo** — they are
reproducible from source, valid only on the machine and fonts that recorded
them, and re-recording writes megabytes of unreviewable binaries into history.

On a fresh checkout there are no baselines yet, so record them once:

```sh
npm run test:visual:update    # records
npm run test:visual           # compares from here on
```

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
6. `npm run docs:reference` — `npm test` fails if you skip this too.

## Licence

MIT
