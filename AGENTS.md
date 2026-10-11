# AGENTS.md

Read this before touching the repository. It is the whole of what you need
resident; everything else is on demand and linked at the bottom.

## What this solves

An AI agent asked to plan work emits Markdown. Markdown renders poorly and
**the reader cannot answer it** — no way to pick an option, attach a comment, or
send a decision back. The workaround is to have the agent hand-write bespoke
HTML, CSS and JS every time: roughly **25,000 output tokens per plan**,
inconsistent, and drifting from the intended design on every run.

ForgeDoc ships the runtime once, so the agent writes **only semantic markup** —
about **4,000 tokens** for the same document. Everything else is derived:

```html
<style>/*@DOC_CSS@*/</style>   <!-- in <head> -->
<doc-page doc-id="vendor-orders" accent="teal">
  <doc-section title="What we are building">…</doc-section>
  <doc-choice mode="single" question="Should read state be shared?">
    <doc-option recommended>Yes — shared team inbox</doc-option>
    <doc-option>No — per-person read state</doc-option>
  </doc-choice>
</doc-page>
<script>//@DOC_JS@</script>    <!-- last line of <body> -->
```

No `<style>`, no `<script>`, no classes, no ids, no `A`/`B` keys, no `1.2.1`
numbers. `forgedoc build` validates the markup and swaps those two placeholders
for the real runtime, rewriting the document in place — **one `.html` for the
document's whole life**, revised and rebuilt rather than copied. The reader answers inline; the answers persist; they
press Copy and paste a `=== FB v1 ·` block back to the agent.

The loop is: **agent writes markup → build → human answers → paste bucket back →
agent regenerates.** Every design decision below serves that loop.

## Identity

- npm package **`forgedoc`** · CLI binary `forgedoc` · IIFE global `ForgeDoc`
- Skill **`better-plan`**, installed with `npx skills add MrBns/plankit`
- The binary, global and `forgedoc.*` filenames are documented API — do not rename

## Commands

```sh
npm run build        # tsdown: 3 runtime variants + CLI, then tsc for .d.ts
npm run dev          # Vite dev server, opens the kitchen-sink QA page
npm test             # Vitest: real Chromium + node projects
npm run check        # format, lint, typecheck, build, test — run before finishing
npm run docs:generate    # regenerate REFERENCE.md + both CHEATSHEET.md copies
npm run test:visual      # browser e2e: offline, CDN and themed builds
```

**Appearance is not tested.** No screenshots, no computed-style assertions, no
geometry. Styling is expected to change, so breaking it is not a test failure —
check themes by looking at them (`npm run preview`).

**Vite does not build.** `npm run build` is tsdown; Vite is the dev server and
the Vitest runner only, and never writes to `dist/`.

## The five constraints

Every unusual decision traces to one of these. Full rationale in
[docs/PLAN.md](docs/PLAN.md) §2 — the source cites these by number in 247 places.

1. **Light DOM only (§2.1).** Zero `attachShadow`, enforced by
   `npm run lint:no-shadow`. Selection APIs do not cross shadow boundaries, and
   the feedback bucket depends on them.
2. **Enhance in place (§2.2).** Read the author's DOM, append chrome *around*
   it, never move a node. Moving a text node invalidates every live `Range`, and
   highlight restore runs right after mount. One documented exception exists —
   a disclosure's content region, `ensureContentElement()` — and §2.2 says why.
3. **A host that holds author prose is a block.** Never a grid or a flex
   container. Loose text between two element children becomes an anonymous
   layout item on a row of its own, and no selector can reach it to put it
   back — so the sentence shreds down a column. Position the chrome instead.
4. **Works from `file://` with no network (§2.3).** The offline bundle is IIFE
   (ESM is CORS-blocked on `file://`) and reaches for nothing.
5. **Zero generation tokens for the runtime (§2.4).** It is injected by
   replacing two placeholders, never emitted by the model.
6. **No framework for the elements (§2.5).** Plain `HTMLElement` subclasses.
   Svelte is used for the bucket panel and the question drawer *only*, because
   both are entirely runtime-created. Rule: runtime creates the DOM → Svelte
   fine; runtime enhances author DOM → vanilla. Neither is a custom element:
   in Svelte's custom-element mode component styles are inlined as a JavaScript
   string instead of emitted as CSS, which puts them outside `@layer` and out
   of reach of both the `--doc-*` tokens and the author's escape hatch.

## Layout

```text
src/core/          DocElement base, store, slug, numbering, registry
src/components/    one file per tag, named exactly after it
src/bucket/        selection, serialise, and the three .svelte files
src/questions/     the question drawer: model.ts scrapes, two .svelte render
src/styles/        index.css imports 30 files IN ORDER; layers.css first
tools/             validate.ts, inject.ts, cli.ts, gen-reference.mjs
skills/better-plan/  the published skill — SKILL, CHEATSHEET, REFERENCE
docs/              PLAN.md, DECISIONS.md — repo-only, never shipped
website/           separate Fumadocs/Next.js handbook; does not ship in the runtime
```

Adding a component touches six places; `tools/gen-reference.mjs` and the
kitchen-sink fixture both fail `npm test` if you skip them. See PLAN.md §14.

## Sharp edges

Each of these builds green and produces wrong output. They cost real time.

- **tsdown nests `define` under `transform`.** At top level it is a *warning*,
  the build succeeds, and the CLI ships `0.0.0-dev` instead of the version.
- **Mermaid is an optional peer dependency**, so tsdown externalises it. The
  standalone variant needs `deps.alwaysBundle: ['mermaid']` or you get a 157 kB
  "offline" bundle with no Mermaid — §2.3 broken silently. Sanity check: the
  standalone artefact is ~3.5 MB, roughly 20× the cdn one.
- **`@mermaid-source` needs a `resolveId` plugin, not `alias`.** `tsconfig.json`
  maps it to the cdn variant so `tsc` can typecheck, and tsdown resolves
  tsconfig `paths` ahead of `alias` — so all three variants silently ship the
  cdn source.
- **tsdown runs its configs concurrently.** No config may set `clean: true`;
  `npm run build` clears `dist/` once, up front.
- **A Svelte prop named `state` breaks every `$state()` rune in the file.**
  Svelte reads `$name` as a store subscription whenever `name` is declared, so
  the rune resolves to the prop and throws `store_invalid_shape` at runtime.
  The rune wins the name; the prop takes another.
- **Biome corrupts `.svelte` files** — it hoists `interface Props` above its own
  doc comment and dedents the script body. They are excluded from the formatter
  and stay hand-formatted.
- **Biome cannot see Svelte templates**, so `noUnusedVariables` and
  `noUnusedImports` are off there — every `$props()` binding reads as unused.
- **Biome has no Markdown support at all.** `.md` files are not formatted.
- **Every root config file must be in `tsconfig.json` `include`.** One left out
  loses `types: ["node"]`, so `npm run typecheck` passes while the editor
  reports `Cannot find name 'node:fs'`.
- **`tests/fixtures/` is never formatted.** `doc-code`, `doc-diff` and
  `doc-tree` render their content verbatim and the validator tests assert exact
  line numbers.
- **Do not assert on minifier output.** A test pinned to `dataset.forgedoc="1.0.0"`
  broke when oxc emitted a template literal instead. Match behaviour, not quoting.

## Conventions

Named exports only, no default exports outside config files. Explicit return
types on exported functions. A `// why:` comment at every site shaped by a §2
constraint — six months on, the reason must be readable at the call site, not
archaeology. Functions under ~40 lines, nesting depth ≤ 3. Do not abstract
before the third occurrence.

**Record every new dependency in [docs/DECISIONS.md](docs/DECISIONS.md)** with
its reason — §12 requires it, and that table is kept current.

The documentation app has its own package, lockfile, and TypeScript project.
Run `npm run docs:site:build` and `npm run docs:site:check` when changing it.
Next.js route modules require default exports; those framework entry points
are the exception to the named-export convention. Component reference pages
under `website/content/docs/reference/` are generated from the committed
`docs/REFERENCE.md`; edit the contract and documentation source, then run
`npm run docs:generate` instead of editing the generated website pages.

## Going deeper

| | |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | The build specification. What the `§` references in the source resolve to. §1–§2 and §6–§10 are current; the toolchain sections are marked as superseded. |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Flagged deviations from a MUST, the dependency register, and the bugs the acceptance criteria caught. |
| [docs/CHEATSHEET.md](docs/CHEATSHEET.md) | The whole tag vocabulary on one page. |
| [README.md](README.md) | What a user reads. |
