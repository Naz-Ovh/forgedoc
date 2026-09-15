# ForgeDoc — Build Specification

**A web component library for AI-authored interactive planning documents.**

Target implementer: an autonomous coding agent with full repo access.
Status: greenfield. Nothing exists yet except a working prototype whose *visual output* is the reference (see §1.3).

---

## 0. How to read this document

This is a build contract, not a suggestion. Sections marked **MUST** are non-negotiable and several of them are counter-intuitive — they exist because of hard constraints explained inline. Do not "improve" them without flagging first.

Where this document says *flag*, it means: stop, write the question into `docs/DECISIONS.md`, and continue with the stated default.

Read §2 (Constraints) in full before writing any code. Almost every unusual decision downstream traces back to one of those five constraints.

---

## 1. Mission

### 1.1 The problem

An AI coding agent, when asked to plan work, currently emits a Markdown file. Markdown renders poorly in editors and terminals: no rich layout, no interactivity, no way for the reader to answer a question or attach a comment. The current workaround is to have the agent generate a bespoke HTML file with hand-written CSS and JS every single time — which burns thousands of output tokens per plan, produces inconsistent results, and silently drifts from the intended design rules.

### 1.2 The solution

Ship a component library. The agent writes **only semantic markup**. All styling, layout, interactivity, state persistence, and feedback collection come from a prebuilt runtime.

```html
<doc-page doc-id="vendor-orders" density="comfortable" accent="teal">
  <doc-header kicker="Plan · Universabile vendor dashboard">
    Vendor orders experience
    <p slot="lede">Vendors get told the moment a new order lands…</p>
  </doc-header>

  <doc-section title="What we are building">
    <p>One feature, three faces…</p>
  </doc-section>
</doc-page>
```

That is the entire authoring surface. No `<style>`, no `<script>`, no class names, no ids, no `A`/`B`/`C` option keys, no `1.2.1` section numbers. Every one of those is derived by the runtime.

### 1.3 Visual reference — do not redesign

A prototype already produces the exact intended look: dense but airy editorial layout, teal accent, generous line-height, prominent hierarchical section numbers, two-column compare panels, coloured callouts, a numbered roadmap of collapsible stages, question cards with lettered options, and a floating feedback bucket.

**MUST:** match that visual language. This project is an engineering exercise, not a design exercise. Where this spec is silent on a visual detail, reproduce the reference. Do not introduce a new palette, a new type scale, or decorative flourishes.

### 1.4 Success metric

A plan of the size and richness of the reference document should cost the authoring agent **under 4,000 output tokens** of markup, versus roughly 25,000 today, and should render byte-identically every time.

---

## 2. Constraints — read these first

### 2.1 MUST: light DOM only. No shadow DOM anywhere.

Not one `attachShadow` call in the codebase.

Why: the feedback system lets a reader select arbitrary text anywhere in the document and attach a comment, with highlights that persist across reloads. Selection APIs do not cross shadow boundaries cleanly — `window.getSelection()` is scoped to the shadow root and you would need `getComposedRanges()` plus per-root bookkeeping. Browser find-in-page and print-to-PDF also degrade. None of shadow DOM's benefits apply here: this is a standalone document with no third-party CSS to collide with.

Everything shadow DOM would have given you has a replacement:

| Shadow DOM feature | Replacement |
| --- | --- |
| Style encapsulation | CSS cascade layers + `--doc-*` prefix |
| `::part()` | Direct selection — you already have more access |
| `<slot>` | Children are already in the right place; enhance in situ |

Note that custom element **lifecycle** (`connectedCallback`, `attributeChangedCallback`, `observedAttributes`), `ElementInternals`, and custom states all work perfectly without a shadow root. Avoiding shadow DOM costs you no functionality.

### 2.2 MUST: enhance in place. Never reparent author content.

Components receive DOM the agent wrote. Their job is to read it, wrap chrome *around* it, and wire behaviour — never to move it.

Allowed: appending new elements (a letter badge, an "Other" textarea, a collapse chevron), adding attributes and classes to existing elements, reading text content.

Forbidden: `innerHTML = ...` on a subtree containing author content, `appendChild` of an existing author node into a new wrapper, template-rendering over the render root.

Why: moving a text node invalidates every live `Range`. Highlight restoration runs immediately after mount. If you reparent, you will spend days chasing ordering bugs.

This constraint is why no component framework is used — see §2.5.

**The one exception: a disclosure's content region.** `doc-collapse`, `doc-stage` and `doc-tab` close by setting `hidden="until-found"` on their content. That is an attribute, and a text node has none — so a panel written as a bare sentence had nothing to set it on and stayed on screen when closed. `ensureContentElement()` in `core/disclosure.ts` builds one `<div data-part="body">` and moves the author's content into it.

That is allowed here, and *only* here, because the reason above does not apply:

- It runs inside `enhance()`, before any `Range` exists to invalidate.
- A highlight is anchored by character offset into the anchor's `textContent` (`SerializedRange`, §10.2), never by node identity — and a container does not change `textContent` by one character.

The alternative was hiding loose prose with `visibility` or a clip, which takes it away from Ctrl+F with nothing to put it back. A container the reader can never observe is the better trade. Do not read this as licence to wrap anywhere else: every other component handles loose prose by *not being a layout container*, which needs no wrapper at all.

### 2.3 MUST: work from `file://` with no network.

The primary delivery mode is a single self-contained `.html` file opened with `xdg-open`. That means:

- The distributed bundle must be **IIFE**, not ESM. ES module imports are blocked by CORS on `file://`.
- No runtime `fetch`, no dynamic `import()` of a remote URL, no web fonts from a CDN in the offline build.
- `localStorage` on `file://` is unreliable (historically Chrome shares one bucket across *all* `file://` documents; Safari may block it). See §9.3 for required mitigations.

A CDN build also ships (§5.2), but the offline build is the one that must never break.

### 2.4 MUST: zero generation tokens for the runtime.

The runtime is never emitted by the model. It is injected post-generation by a build step that string-replaces two placeholders. The authoring agent writes markup and runs one command.

### 2.5 MUST: no component framework for the custom elements.

Use plain `HTMLElement` subclasses.

- **Svelte is disqualified for the elements.** Its `shadow: "none"` mode — the only light-DOM option — explicitly does not support slots. Since every component in this library is a wrapper around agent-authored children, there is no way to render that content. This is not an edge case; it is the entire use case.
- **Lit is a closer fit** (`createRenderRoot() { return this }` is a documented one-liner) but its template still owns the render root, so rendering into `this` overwrites the children you are trying to enhance. You would end up importing LitElement solely for property observers that `attributeChangedCallback` already provides.

Svelte **is** used, but only for the bucket panel (§10), which is runtime-created DOM with no author content in it. That distinction is the rule:

> If the runtime creates all the DOM → Svelte is fine.
> If the runtime enhances agent-written DOM → vanilla.

---

## 3. Repository layout

```text
forgedoc/
├── package.json              # npm name: forgedoc
├── AGENTS.md                 # loaded every session — start here
├── tsdown.config.ts          # builds every shipped artefact
├── vite.config.ts            # dev server + Vitest only
├── biome.jsonc               # lint + format
├── tsconfig.json
├── src/
│   ├── index.ts              # entry: imports everything, defines elements
│   ├── core/
│   │   ├── base.ts           # DocElement base class
│   │   ├── registry.ts       # define() helper + upgrade guard
│   │   ├── store.ts          # namespaced persistent store
│   │   ├── slug.ts           # heading → stable id
│   │   ├── numbering.ts      # section / stage / option sequencing
│   │   └── parts.ts          # data-part query helpers
│   ├── components/
│   │   ├── doc-page.ts
│   │   ├── doc-section.ts
│   │   ├── doc-choice.ts
│   │   └── …                 # one file per component, no exceptions
│   ├── bucket/
│   │   ├── mount.ts          # creates host div, mounts Svelte app
│   │   ├── BucketPanel.svelte
│   │   ├── BucketItem.svelte
│   │   ├── selection.ts      # range capture + highlight restore
│   │   └── serialize.ts      # wire format writer/reader
│   ├── styles/
│   │   ├── layers.css        # @layer declaration — MUST import first
│   │   ├── tokens.css        # :root defaults
│   │   ├── presets.css       # attribute-selected preset bundles
│   │   ├── base.css          # element resets, prose, typography
│   │   ├── components/*.css  # one file per component
│   │   ├── print.css
│   │   └── index.css         # imports the above IN ORDER
│   └── vendor/
│       ├── highlight.ts      # Prism wrapper, explicit language list
│       └── mermaid.ts        # lazy in cdn build, bundled in standalone
├── tools/
│   ├── validate.ts           # markup contract validator
│   ├── inject.ts             # placeholder replacement
│   └── cli.ts                # `forgedoc build|validate|new`
├── tests/
│   ├── components/*.test.ts
│   ├── fixtures/kitchen-sink.html
│   └── golden/
├── skills/
│   └── better-plan/          # the published skill — `npx skills add`
│       ├── SKILL.md          # how an agent authors a plan
│       ├── CHEATSHEET.md     # one page — the agent's primary reference
│       └── REFERENCE.md      # full per-component API, generated
└── docs/                     # repo-only, never shipped
    ├── PLAN.md               # this document — what the § references resolve to
    └── DECISIONS.md          # deviations, dependency register, change log
```

**MUST:** one component per file, named exactly after its tag. No barrel files that re-export with renaming. An agent (or human) reading `src/components/doc-choice.ts` should find everything about `<doc-choice>` there.

---

## 4. Build

### 4.1 Toolchain

> **Partly superseded.** The constraint sections of this document (§1–§2, §6–§10)
> still hold and are what the 247 `§` references in the source resolve to. The
> toolchain below was replaced after the original build; the repository is
> authoritative and `AGENTS.md` carries the current commands.

- **tsdown** — builds every shipped artefact: the three runtime variants,
  `dist/cli.js`, and the declarations, from one `tsdown.config.ts`. Runs on
  Rolldown, the same engine under Vite 8.
- **Vite 8** — dev server and Vitest only. It no longer writes to `dist/`, and
  `vite build` is not part of `npm run build`.
- **TypeScript**, `strict: true`, `target: "ES2022"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`.
- **Svelte 5** — bucket panel only, with runes.
- **Vitest** with **browser mode** (Playwright provider). See §13.
- **Biome** — one binary for lint and format, replacing ESLint and Prettier.

ES2022 is the floor because `ElementInternals`, `CustomStateSet`, `structuredClone`, and class private fields are all used. Do not down-level; the target audience is a modern browser opening a local file.

### 4.2 Build outputs

Three JS bundles and one CSS file, from one source tree:

| Output | Format | Contents | Used by |
| --- | --- | --- | --- |
| `dist/forgedoc.iife.js` | IIFE, global `ForgeDoc` | Core + Prism. Mermaid lazy-loaded from CDN. | CDN / hosted viewer |
| `dist/forgedoc.standalone.iife.js` | IIFE | Everything, Mermaid included | Offline `file://` injection |
| `dist/forgedoc.js` | ESM | Core, external deps | npm consumers, tooling |
| `dist/forgedoc.css` | CSS | All layers, one file | Both |

Mermaid is ~1 MB. Bundling it into the CDN build punishes every reader; omitting it from the offline build breaks the offline promise. Two builds resolves this cleanly. The lazy loader in `vendor/mermaid.ts` must be a single swappable module so the two builds differ by one import.

### 4.3 `tsdown.config.ts` requirements

The build is an array of configs — one per shipped artefact — which tsdown runs
**concurrently**. Each requirement below survived the move off Vite lib mode.

**MUST:** one CSS file, always (`css.splitting: false`, `css.fileName:
'forgedoc.css'`). Per-component CSS files that ship separately would break the
layer ordering guarantee (§4.4).

**MUST:** the variants differ by exactly one aliased module — `@mermaid-source`
— and the source tree is never forked. This is done with a `resolveId` plugin,
**not** tsdown's `alias`: `tsconfig.json` maps that specifier to the cdn variant
so `tsc` has something to typecheck, and tsdown resolves tsconfig `paths` ahead
of `alias`. Getting this wrong is silent — all three variants build happily and
all three ship the cdn source.

**MUST:** the standalone variant sets `deps.alwaysBundle: ['mermaid']`. Mermaid
is an *optional peer dependency* and tsdown externalises those by default, which
otherwise produces a 157 kB "offline" bundle with no Mermaid in it — §2.3 broken
by a green build.

**MUST:** no config may set `clean: true`. They run concurrently into the same
`dist/`, so `npm run build` clears it once, up front.

**MUST:** sourcemaps are published. Readability is a requirement (§12) and a
debuggable dist is part of that.

### 4.4 CSS layer ordering

`src/styles/layers.scss` contains exactly one statement and **MUST** be the first thing each theme's `index.scss` loads:

```css
@layer doc.reset, doc.tokens, doc.preset, doc.base, doc.components, doc.theme, doc.utilities;
```

`doc.theme` sits immediately after `doc.components`: `src/styles/base/` ships structure into `doc.components`, and each `src/styles/themes/<name>/` ships everything visual into `doc.theme`. That one position is what lets a theme override any base declaration — including a structural one — at equal or lower specificity, with no `!important`. It sits *before* `doc.utilities` so the author's own escape hatch still wins over whichever theme was compiled in.

Every rule the library ships **MUST** live inside one of those layers. Nothing outside a layer.

This is the mechanism that makes the library both opinionated and fully overridable: **any CSS the author writes outside a layer beats every shipped rule, regardless of specificity.** A one-word selector wins:

```css
/* author's escape hatch — no !important, no specificity math */
doc-note { border-radius: 0; }
```

This also solves the classic component-library problem the frontend-design guidance warns about — type selectors and class selectors cancelling each other unpredictably. Inside layers, order is explicit.

---

## 5. Distribution and consumption

### 5.1 Package

Publish as `forgedoc` on npm. `unpkg` and `jsdelivr` serve from npm automatically. Submitting to cdnjs is optional and can wait for v1.1 — flag it, don't block on it.

```json
{
  "name": "forgedoc",
  "type": "module",
  "main": "./dist/forgedoc.js",
  "types": "./dist/index.d.ts",
  "bin": { "forgedoc": "./dist/cli.js" },
  "exports": {
    ".":            { "types": "./dist/index.d.ts", "import": "./dist/forgedoc.js" },
    "./style.css":  "./dist/forgedoc.css",
    "./standalone": "./dist/forgedoc.standalone.iife.js"
  },
  "sideEffects": ["*.css", "./dist/forgedoc.iife.js", "./dist/forgedoc.standalone.iife.js"]
}
```

### 5.2 CDN mode

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/forgedoc@1.0.0/dist/forgedoc.css">
<script defer src="https://cdn.jsdelivr.net/npm/forgedoc@1.0.0/dist/forgedoc.iife.js"></script>
```

**MUST** use `defer` (or place the tag at end of `<body>`). Elements are defined after the document is parsed, so every element upgrades once, synchronously, with all of its children already present. This eliminates the classic light-DOM footfun where `connectedCallback` fires mid-parse and the component sees an incomplete subtree. Write the components assuming children exist at upgrade time — no `MutationObserver` gymnastics, no `setTimeout(0)`.

### 5.3 Offline mode — the primary path

The authoring agent writes two placeholders, byte for byte — the first in `<head>`, the second as the last line of `<body>`:

```html
<style>/*@DOC_CSS@*/</style>
<script>//@DOC_JS@</script>
```

Then runs `forgedoc build DOC_foo.html`, which validates (§11) and replaces both placeholders with file contents. Output: one self-contained `.html`, no network, no CDN, no dependencies.

**MUST:** use a replacement *function* (`.replace(needle, () => content)`) not a string. A `$&` or `$1` sequence anywhere in the minified bundle will corrupt the output if you pass a string.

**MUST:** the styles end up in `<head>` whichever flavour is built — embedded `<style>` no less than the CDN `<link>`. A stylesheet at the end of the body renders, but the reader sees a frame of unstyled semantic markup first. The build therefore *hoists*: wherever the placeholder was written, its replacement lands in `<head>`, so a document authored against the older end-of-body shape still builds correctly. The script does not move — end of `<body>` is where it belongs (§5.2).

### 5.4 Version stamp

`doc-page` **MUST** set `data-forgedoc="<version>"` on itself at upgrade. Injected into the bundle at build time from `package.json`. When a user pastes a feedback bucket back into a fresh session, the version tells the agent which markup contract was in force.

---

## 6. Token system

### 6.1 Rules

- **Every** token is prefixed `--doc-`. Non-negotiable: Mermaid and Prism both inject stylesheets and read root-scoped values. An unprefixed `--border` or `--radius` is a collision waiting to happen.
- Defaults live on `:root` inside `@layer doc.tokens`.
- Presets are **attribute selectors** on `doc-page` inside `@layer doc.preset`. State lives in the DOM — one source of truth, validatable against an enum, switchable at runtime with a single `setAttribute`, and reachable from the print stylesheet.
- Custom properties inherit, so a subtree override works anywhere: `<doc-table style="--doc-space-unit: 3px">`.

### 6.2 Derive from units, not from lists

**MUST:** the spacing scale derives from one unit and the type scale from one base + one ratio. If a preset has to restate forty values, presets drift apart within a month and every new component means editing every preset.

```css
@layer doc.tokens {
  :root {
    --doc-space-unit: 4px;
    --doc-space-1: calc(var(--doc-space-unit) * 1);
    --doc-space-2: calc(var(--doc-space-unit) * 2);
    /* … through --doc-space-12 */

    --doc-text-base: 16px;
    --doc-text-ratio: 1.2;
    --doc-text-sm:  calc(var(--doc-text-base) / var(--doc-text-ratio));
    --doc-text-lg:  calc(var(--doc-text-base) * var(--doc-text-ratio));
    /* … */
  }
}
```

### 6.3 Preset axes — independent, never bundled into one attribute

Four orthogonal axes. A "compact" document must be able to have a wide measure and a light code theme.

| Attribute | Values | Default | Controls |
| --- | --- | --- | --- |
| `density` | `compact` `comfortable` `spacious` | `comfortable` | `--doc-space-unit`, line-height, component padding |
| `scale` | `sm` `md` `lg` | `md` | `--doc-text-base`, `--doc-text-ratio` |
| `accent` | `teal` `indigo` `slate` `plum` `amber` | `teal` | accent ramp + derived tints |
| `measure` | `narrow` `default` `wide` | `default` | `--doc-measure` (720 / 1200 / 1600px) |
| `code` | `auto` `light` `dark` | `auto` | Prism theme tokens |

```css
@layer doc.preset {
  doc-page[density="compact"]  { --doc-space-unit: 3px; --doc-leading: 1.55; }
  doc-page[density="spacious"] { --doc-space-unit: 5px; --doc-leading: 1.85; }
  doc-page[measure="wide"]     { --doc-measure: 1600px; }
  doc-page[accent="plum"]      { --doc-accent-600: …; --doc-accent-50: …; }
}
```

Named *bundles* (e.g. "presentation" = `density="spacious" scale="lg" measure="narrow"`) go in the docs as recommended combinations. They are not a fifth attribute.

### 6.4 Colour

Single ramp definition per accent (50 / 100 / 200 / 400 / 600 / 800 / 900) plus neutral, plus four semantic ramps (info, success, warning, danger) that do **not** change with `accent`.

**MUST:** use `light-dark()` on one token set with `color-scheme: light dark` on `doc-page`. No `@media (prefers-color-scheme)` duplication, no theme toggle, no two-stylesheet approach.

```css
--doc-surface-1: light-dark(#ffffff, #16181a);
--doc-text-1:    light-dark(#1b1d1f, #e6e4dd);
```

### 6.5 Typography

**MUST NOT** use serif faces for body, headings, or code — a hard rule inherited from the existing skill. Serif is permitted only if the author explicitly sets `--doc-font-display`.

Stack: a geometric/neo-grotesque sans for display and body, a legible mono for code. Ship **no web fonts** in the offline build — use a well-chosen system stack with `font-feature-settings` tuned for tabular numerals in tables and code. The CDN build may optionally `@import` a font; flag this and default to system stack.

### 6.6 Overriding — the documented escape hatch

Three tiers, documented in `CHEATSHEET.md` in this order:

1. **Preset attributes** — `<doc-page density="compact">`. Validatable. Preferred.
2. **Token override** — `doc-note { --doc-accent-600: #8b5cf6; }`. Semantic, survives upgrades.
3. **Raw CSS** — `doc-note [data-part="title"] { letter-spacing: .02em; }`. Wins automatically via layers. Only `data-part` selectors are public API (§7.3); internal class names are not, and will change.

---

## 7. The base class

### 7.1 `DocElement`

Roughly 40 lines. Every component extends it. It provides:

```ts
export abstract class DocElement extends HTMLElement {
  protected internals = this.attachInternals();

  connectedCallback(): void {
    if (this.dataset.docUp) return;   // idempotency guard — see 7.2
    this.dataset.docUp = '';
    this.enhance();
  }

  disconnectedCallback(): void {
    this.teardown();
  }

  /** Read children, append chrome, wire events. Never move author nodes. */
  protected abstract enhance(): void;

  protected teardown(): void {}

  /** Query a public part within this component, not nested ones. */
  protected part(name: string): HTMLElement | null { … }

  /** Toggle a CSS custom state, targetable as :state(name). */
  protected setState(name: string, on: boolean): void {
    on ? this.internals.states.add(name) : this.internals.states.delete(name);
  }
}
```

### 7.2 Idempotency is mandatory

**MUST:** every component guards against double-enhancement. The runtime gets re-run during iteration and re-injected on rebuild. Double-injected letter badges and duplicate event listeners are miserable to debug.

### 7.3 `ElementInternals` and custom states

Both work without a shadow root and both are required.

**ARIA via internals, not markup.** The agent should never write `role=` or `aria-*`. Set them in `enhance()`:

```ts
this.internals.role = 'radiogroup';
this.internals.ariaLabel = this.questionText;
```

**State via `CustomStateSet`, not class names.** This keeps state out of `class` where an author might collide with it:

```ts
this.setState('open', true);
```

```css
@layer doc.components {
  doc-collapse:state(open) [data-part="body"] { display: block; }
}
```

### 7.4 `data-part` is the public internals API

Because there is no shadow DOM, authors *can* select internal class names — which means they *will*, and a refactor will then break existing plans. Prevent that by exposing a deliberate surface:

```html
<doc-note kind="warn">
  <div data-part="icon">…</div>
  <div data-part="title">…</div>
  <div data-part="body">…</div>
</doc-note>
```

`data-part` values are documented, stable, and covered by semver. Everything else is internal. This gives `::part()` ergonomics with no shadow root and full freedom to restructure.

**MUST:** `part()` must not match parts of nested components. Scope the query to descendants whose nearest `doc-*` ancestor is `this`.

### 7.5 Display defaults

**MUST:** the very first rule in `@layer doc.base` sets `display: block` on every `doc-*` tag. Unknown and un-upgraded elements default to `display: inline`, which produces a broken flash of layout before the script runs.

---

## 8. Component vocabulary

22 tags the agent must learn, plus 9 child-only tags and 1 the runtime generates. Grouped below. `CHEATSHEET.md` must fit this on one page; if it does not, the vocabulary has grown too far and something must merge.

For every component: **Attributes** are what the agent writes. **Parts** are the public `data-part` surface. **Derived** is what the runtime computes so the agent never types it.

### 8.1 Shell

---

#### `<doc-page>` — the root, and the only authored root

**Attributes**

| Name | Values | Req | Notes |
| --- | --- | --- | --- |
| `doc-id` | slug | **yes** | Storage namespace. Validator rejects a doc without it. See §9.3. |
| `density` `scale` `accent` `measure` `code` | see §6.3 | no | Preset axes |
| `toc` | `open` `closed` `off` | no | Default `closed` on narrow, `open` ≥1280px |

**Derived:** `data-forgedoc` version stamp, `color-scheme`, the centred reading column, the TOC sidebar, the bucket mount point, all persisted state.

**Layout — MUST:**

- Reading column is horizontally centred at every viewport. Never left-hugging on ultrawide.
- Container never exceeds `--doc-measure` (default 1200px). Above 2560px viewport it may widen to 1600px.
- From 1050px up, use 90% of viewport width, still capped and centred.
- Below 1050px, full width with comfortable horizontal padding.

**Implementation note — MUST NOT reparent.** Do not wrap children in a generated `<div class="column">`. Style the column directly via `doc-page > *` and append the TOC and bucket as *siblings* of that content. Reparenting invalidates live ranges and highlight restore runs immediately after mount (§2.2).

**Ownership:** `doc-page` owns the single store instance (§9) and the print stylesheet behaviour (§8.8). Exactly one per document; validator errors on two.

---

#### `<doc-header>`

**Attributes:** `kicker` (small caps eyebrow line).
**Children:** heading text as the default content; an optional `<p slot="lede">`.
**Parts:** `kicker`, `title`, `lede`.

Note: `slot` here is a plain attribute used as a selector hook, not a shadow slot. Do not move the node — style it in place.

---

#### `<doc-section>`

**Attributes:** `title` (string, required), `id` (optional override).
**Nesting:** sections nest to depth 3.
**Parts:** `number`, `heading`, `body`.

**Derived — this is the highest-value component in the library:**

- **Number** from nesting depth via CSS counters: `1`, `1.1`, `1.1.1`. The agent never types a number.
- **Id** by slugifying `title` → `sec-what-we-are-building`. This satisfies the anchor-stability rule for free: if a section's meaning changes, its title changes, so its id changes. If the title is unchanged, the id is stable across regenerations.
- **TOC entry**, automatically.

**Numbering MUST:** the number is at least as large as its heading text, and shrinks with depth (depth 1 largest). Never render it as small chrome beside a big heading.

**Known trade-off:** CSS counter content is not selectable or copyable. This does not affect the feedback bucket, which resolves by anchor id. If copyable numbers are wanted later, add a runtime pass that writes real text nodes into `[data-part="number"]`. Default: CSS counters. Flag if you disagree.

**Duplicate slugs:** append `-2`, `-3`. Validator emits a **warning**, not an error — two sections with the same title is a content smell but not fatal.

---

#### `<doc-toc>` — generated, never authored

Built from the `doc-section` tree at mount. Collapsible, sticky, scroll-spy highlighting the current section. The validator **errors** if the agent writes this tag manually.

---

### 8.2 Meta

#### `<doc-chips>` / `<doc-chip>`

The pill row under the lede. Carries real meaning: locked decisions and reader instructions.

**`doc-chip` attributes:** `kind` = `confirmed` | `info` | `action` | `pending`.

**Runtime hook:** when a feedback bucket is pasted back and the agent regenerates, previously answered questions should surface here as `confirmed` chips. Expose `ForgeDoc.chips.add({kind, text})` so tooling can do this without a full regeneration.

---

### 8.3 Prose and callouts

#### `<doc-note>`

**Attributes:** `kind` = `info` | `tip` | `warn` | `danger` | `success`; `title` (optional).
**Parts:** `icon`, `title`, `body`.

Reference uses at minimum a teal explainer and an amber "also fixed in this stage".

---

#### `<doc-blocker>`

Structurally distinct from a note because the shape is **enforced**. The source skill requires that every roadblock states what it blocks and what action resolves it; making that a validated structure is the point.

```html
<doc-blocker severity="high" title="SSE stream loses CORS headers on takeover">
  <doc-blocks>The browser silently drops the stream — bell never updates.</doc-blocks>
  <doc-why>The route takes over the raw connection; plugin headers are lost.</doc-why>
  <doc-action>The stream route writes the CORS headers itself.</doc-action>
</doc-blocker>
```

**Attributes:** `severity` = `low` | `medium` | `high` (drives colour), `title` (required).
**Children:** `<doc-blocks>` required, `<doc-why>` optional, `<doc-action>` **required**.
**Derived:** sequence number within the document.

**Validator MUST error** on a `doc-blocker` with no `doc-action`. A roadblock without a resolution is exactly the failure this library exists to prevent.

---

#### `<doc-list>`

**Attributes:** `marker` = `check` | `cross` | `arrow` | `dot` | `number`.

The atom underneath `doc-compare`, exposed separately so ✓/✗ lists work outside a two-column layout. Children are plain `<li>`.

---

#### `<doc-term>`

**Attributes:** `href` (**required**).

Inline. Wraps a technical term and links it out. The source skill mandates hyperlinking terms; making it a tag lets the validator reject one without an `href`, and lets first mention be styled differently from repeats (runtime tracks occurrences per document).

---

#### `<doc-ref>`

**Attributes:** `to` (a section / stage / question id).

Inline cross-reference that resolves to the live number at build time. Once numbering is automatic, any hardcoded "see Stage 5" in prose is a latent bug the moment stages shift. Validator **errors** on an unresolvable `to`.

---

#### `<doc-quote>`

**Attributes:** `cite` (optional).
Distinct typographic role, per the source skill.

---

#### `<doc-table>`

Wraps a plain `<table>`. Header row styling, first-column emphasis, inline `<code>` and links inside cells, tabular numerals.

**Attributes:** `size` = `sm` | `md`; `stack` = `auto` | `never`.

**MUST:** below 1050px, `stack="auto"` converts rows into stacked label/value cards. Tables are the first thing that breaks on narrow viewports and the reference document has two wide ones.

---

### 8.4 Interactive

#### `<doc-choice>` / `<doc-option>`

The most important interactive component. **Every rule the authoring agent currently has to remember becomes a runtime default here.**

```html
<doc-choice mode="single" question="When one team member reads a notification, should it show as read for the whole vendor team?">
  <doc-option recommended>
    Yes — shared team inbox
    <p slot="desc">"Unread" means nobody handled it yet. Simplest.</p>
  </doc-option>
  <doc-option>
    No — each person has their own read state
    <p slot="desc">More personal, but needs an extra table.</p>
  </doc-option>
</doc-choice>
```

**Attributes:** `mode` = `single` | `multi`; `question` (required); `id` (optional override).
**`doc-option` attributes:** `recommended` (boolean badge), `value` (optional override).

**Derived — the agent writes none of this:**

- **Letter keys** `A`, `B`, `C`… assigned in document order.
- **The `Other` option**, always appended, key `O`, with a **multiline `<textarea>`** placed *inside* the Other block so it reads as part of that choice — never a stray field below the list. Label inline: `Other — type your own solution`, hint smaller and on the same line. Hidden unless Other is checked.
- **The note field.** A `<textarea>` for a comment on the chosen answer, hidden behind a small `＋ Add a note` toggle at the bottom of the question. Auto-revealed on load if it holds restored text. Placeholder must make clear it is a comment on the answer, not a second answer.
- **Id** by slugifying `question` → `q-<slug>`.
- **Sequence label** `QUESTION 3 · SINGLE CHOICE`.
- **ARIA** `radiogroup` / `group` via `ElementInternals`.

**MUST:** all free-text fields in a question are `<textarea>`, never single-line `<input>`, and share one visual style — same border, padding, radius, background.

**MUST:** option label text stays a direct author text node in the DOM. The bucket serialises labels verbatim so a pasted bucket is self-contained in a fresh session. Do not restructure option text into generated markup.

**Never `disabled`.** A disabled option cannot be read by assistive tech and cannot be selected for feedback. Use `recommended` for emphasis instead.

---

#### `<doc-collapse>`

**Attributes:** `title` (required), `open` (boolean, initial), `sticky` (persist state).
**Parts:** `summary`, `body`.
**State:** `:state(open)`.

Implement with `<details>`/`<summary>` underneath where possible — free keyboard support, free find-in-page expansion in modern browsers, free print behaviour. If that conflicts with the reference styling, flag it; do not silently hand-roll a div toggle.

---

#### `<doc-tabs>` / `<doc-tab>`

**`doc-tab` attributes:** `label` (required), `active` (boolean).
**Persistence:** active tab index stored per `doc-tabs` id.

**MUST:** arrow-key navigation, roving tabindex, `aria-selected` via internals.
**MUST:** in print, tabs flatten into sequential sections with their labels as sub-headings.

---

#### `<doc-checklist>`

Persistent ticks in the store. The reference's "how we verify it works" list is something a reader actually works through. Children are plain `<li>`.

**Attributes:** `id` (optional; derived from nearest section otherwise).

---

### 8.5 Structure

#### `<doc-flow>` / `<doc-flow-node>`

The horizontal chain: `Customer pays → Server settles → Notification → Bell + toast → Table → drawer`.

**Not a Mermaid job.** Each node has a title plus a subtitle, one node can be emphasised, and it must sit inline at reading width without an SVG layout engine.

**`doc-flow-node` attributes:** `title` (required), `active` (boolean, the emphasised dark node).
**Children:** subtitle text.
**MUST:** wraps to multiple rows below 1050px with the arrows rotating or being replaced by vertical connectors.

---

#### `<doc-roadmap>` / `<doc-stage>`

**`doc-stage` attributes:** `title` (required), `subtitle`, `current` (boolean), `open` (boolean).
**Derived:** stage numbers, auto-incrementing from 0. The circular number badge, the sequence rail, and the dark "current stage" treatment are all runtime.

Distinct from `doc-collapse` — this is a numbered sequence with a current-position marker, not a generic disclosure.

**Stage numbering starts at 0** by default (`start` attribute to change), matching the reference where Stage 0 is the next deliverable.

---

### 8.6 Content

#### `<doc-code>`

**Attributes:** `lang` (required), `title`, `wrap`, `highlight` (line ranges, e.g. `3-5,9`).

Prism with an **explicit language allowlist** bundled at build time. Shiki is ruled out — WASM plus grammars is far too heavy for a self-contained file.

**Validator MUST error on a `lang` outside the allowlist.** Silent fallback to plain text is exactly the invisible-drift failure this library exists to remove.

Starting allowlist: `ts js tsx jsx html css json bash sh sql rust python yaml toml diff http text`. Extending it is a one-line change plus a rebuild.

---

#### `<doc-diff>`

**Attributes:** `lang`, `filename`.
**Content:** unified diff text.

Renders with +/- gutters and aligned line numbers. Faking this with `doc-tabs` + two `doc-code` blocks loses the alignment that makes a diff useful.

---

#### `<doc-figure>` — merged from `doc-figure` / `doc-image` / `doc-mermaid-diagram`

**Attributes:** `type` = `svg` | `image` | `mermaid` | `html`; `src` (for `image`); `caption`.
**Child:** `<doc-caption>` (alternative to the attribute, for rich captions).

One box, one caption treatment, one width behaviour. Three tags for what is visually the same frame is vocabulary the agent has to memorise for no benefit.

- `type="mermaid"`: the child text is Mermaid source. **The single biggest token saving in the library** — five lines of Mermaid replaces a few hundred lines of hand-placed SVG, and the model is far more reliable writing it. Theme Mermaid from `--doc-*` tokens so diagrams match the document.
- `type="html"`: for UI wireframes like the reference's drawer mock. **MUST** render inside `<iframe srcdoc>`, not inline. This is the one place isolation genuinely matters — arbitrary markup with its own styles and possibly scripts. Shadow DOM would not have helped here anyway, since it does not isolate JS.

---

#### `<doc-tree>`

Directory and file layouts from indented text. Plans reference paths constantly; a real tree beats prose paths and the agent writing indented text is cheap.

**Attributes:** `root` (optional label).
**Content:** indented plain text; the runtime draws the connectors.

---

#### `<doc-compare>`

Two-column panel — the reference's "Already built" / "Missing (we build these)".

**Attributes:** `columns` (default 2).
**Children:** two or more `<doc-list>` blocks each with a `title` and optional `kind` = `positive` | `negative` | `neutral`.
**MUST:** stacks vertically below 1050px.

---

### 8.7 What NOT to build

**MUST NOT** create tags for inline `<code>`, `<a>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, `<p>`, `<h*>`, `<table>`. Style them globally in `@layer doc.base`. The reference uses all of them heavily and none needs a custom element. Every unnecessary tag is a line on a cheatsheet that has to fit on one page.

### 8.8 Print is a `doc-page` responsibility

The PDF is a real deliverable, not an afterthought. Build this early — retrofitting print across 22 components later is miserable.

**MUST, in `print.css`:**

- Bucket hidden entirely.
- TOC either hidden or flattened into a real contents page with page numbers.
- Every `doc-collapse` and `doc-stage` force-expanded.
- `doc-tabs` flattened to sequential sections with labels as headings.
- `break-inside: avoid` on `doc-note`, `doc-blocker`, `doc-choice`, `doc-figure`, and `doc-compare` panels so they never split mid-box.
- Link URLs printed after link text for external `href`s.
- Background colours preserved via `print-color-adjust: exact` on callouts and code blocks.

---

## 9. Store and persistence

### 9.1 One store, one blob

`doc-page` owns a single store instance. **MUST NOT** let components each reach for `localStorage` — one read on mount, one debounced write (250ms) on change.

```ts
interface DocState {
  version: 1;
  docId: string;
  answers:   Record<string, { keys: string[]; otherText?: string; note?: string }>;
  feedback:  FeedbackItem[];
  collapse:  Record<string, boolean>;
  tabs:      Record<string, number>;
  checks:    Record<string, boolean>;
  toc:       { open: boolean };
}
```

Feedback and answers **MUST** survive reload and are never dropped unless the reader explicitly removes or clears them. Collapse/tab/check state is convenience — losing it is acceptable, losing feedback is not.

### 9.2 Store API

A tiny observable. No framework dependency — the Svelte panel adapts it via a store contract, the vanilla components subscribe directly.

```ts
export interface DocStore {
  get<K extends keyof DocState>(key: K): DocState[K];
  set<K extends keyof DocState>(key: K, value: DocState[K]): void;
  subscribe(fn: (s: DocState) => void): () => void;
  readonly available: boolean;   // false when storage is blocked
}
```

`subscribe` returning an unsubscribe function makes it directly compatible with Svelte's store contract, so the panel can use `$store` syntax with zero glue.

### 9.3 MUST: the `file://` storage problem

Browsers treat `file://` origins inconsistently. Chrome has historically shared a **single `localStorage` bucket across all `file://` documents**; Safari may block it entirely. Two different plan files opened from disk can therefore collide, and one plan's feedback can surface inside another.

Two required mitigations:

1. **`doc-id` is mandatory** and every storage key is namespaced: `forgedoc:<doc-id>:<field>`. The validator rejects a `doc-page` without one.
2. **Detect unavailable storage** with a real write/read/delete probe in a `try/catch` — not a `typeof` check, which passes in Safari private mode and then throws on write. When unavailable, show a persistent, non-dismissible banner: *"Your answers won't survive a reload — use Copy before closing."*

Silent data loss on a feedback tool is the worst possible failure mode. Everything degrades loudly.

---

## 10. The bucket — the one Svelte component

### 10.1 Scope

The floating trigger with count badge, the review panel, the item list with zoom-in-place, per-item remove, and the Copy / Copy & clear / Clear actions.

**MUST** mount as a plain Svelte 5 component via `mount()` into a `<div>` the runtime appends as a sibling of the reading column — **not** as a custom element.

Why this is the right call and the elements are not:

- All of its DOM is runtime-created. There is no author content to preserve, so §2.2 does not apply.
- No slots are needed, so the Svelte light-DOM slot limitation (§2.5) is irrelevant.
- It is genuinely stateful reactive UI — list rendering, transitions, derived counts. This is what Svelte is for.

**Caveat to work around:** in *custom element* mode Svelte inlines component styles as a JavaScript string rather than emitting a CSS file. Mounting as a normal component avoids that entirely — the panel's styles land in `forgedoc.css` where `@layer` and `--doc-*` tokens reach them. Use `:global()` sparingly and keep panel styles inside `@layer doc.components`.

### 10.2 Selection, highlighting, and ranges

`bucket/selection.ts` handles: selection popover, range serialisation to a resilient anchor (nearest `doc-*` ancestor id + text offset + a quoted excerpt for fallback matching), highlight painting, and restore on load.

**MUST** use the CSS Custom Highlight API (`CSS.highlights`) rather than wrapping selections in `<mark>` elements. Wrapping mutates the DOM the reader is selecting from, which breaks subsequent offsets, nests badly on overlapping highlights, and violates §2.2. `CSS.highlights` paints ranges without touching the DOM at all — it is the correct tool and is why the whole light-DOM decision holds together.

Provide a `<mark>`-based fallback only if the API is unavailable, and gate it behind a capability check.

### 10.3 Wire format — backwards compatible

The Copy button emits a block beginning `=== FB v1 ·`. **MUST** keep this format byte-compatible with the existing implementation so buckets already collected against the prototype still parse. Locate the current `bucket_format.txt`, treat it as the spec, and write a round-trip test.

Serialisation rules that carry over:

- Answers serialise question text and chosen option labels **verbatim**, so a pasted bucket is self-contained in a fresh session with no access to the original file.
- The note serialises as `n:` and is omitted when empty.
- An Other answer serialises the reader's typed text as the answer label.

Receipt rules (for the agent reading a pasted bucket back — document these in `SKILL.md`):

- Resolve each item by anchor id first, quoted text second.
- The option **label** is authoritative over the option key. If key and label disagree, or the anchor no longer exists, **ask** — never guess.
- A malformed item invalidates only itself. Process the rest and report the broken one.
- Never attribute an answer to a question whose text does not match verbatim.

---

## 11. Validator and CLI

### 11.1 Build the validator first

Before any component. It defines the contract, and it is what makes the output predictable.

A `plan build` that fails loudly gives the authoring agent a feedback loop it can close alone: write → build → read errors → fix → rebuild. Without it, every failure mode only surfaces when a human opens the file.

### 11.2 Rules

Runs on the raw HTML with `linkedom` or `parse5` — the Node validator **MUST NOT** import the browser runtime.

**Errors** (build fails, no output written):

- `doc-page` missing, duplicated, or without `doc-id`
- Duplicate id anywhere
- `doc-choice` with fewer than two `doc-option` children
- `doc-blocker` without `doc-action`
- `doc-term` without `href`
- `doc-ref` with an unresolvable `to`
- `doc-code` with a `lang` outside the allowlist
- `doc-section` without `title`
- A `doc-toc` written by hand
- Unknown `doc-*` tag (catches typos like `doc-callout`)
- Unknown attribute on a known tag, or an out-of-enum preset value
- Unreplaced `@DOC_CSS@` / `@DOC_JS@` placeholder in a supposedly built file

**Warnings** (build succeeds, message printed):

- Duplicate section slug
- `doc-figure` without a caption
- A section deeper than level 3
- A document with no `doc-choice` at all (a plan with no questions collects no feedback)
- Inline `style=` on a `doc-*` element (works, but suggests a missing preset)

**Output format:** file, line, column, rule id, message, and a suggested fix. Machine-parseable with `--format=json` so an agent harness can consume it directly.

### 11.3 In-page dev banner

In dev builds only, render violations as a red banner at the top of the document. Same rule ids, same messages. Stripped from production output.

### 11.4 CLI surface

```text
forgedoc build <file.html> [--out <file>] [--cdn] [--no-validate]
forgedoc validate <file.html> [--format=json]
forgedoc new <name> [--dir <path>]     # scaffold with the required skeleton
forgedoc version
```

`build` = validate → inject CSS → inject JS → write. Exit non-zero on any error.

---

## 12. Source readability

The dist is minified. **The source is read by humans and by agents extending the library, and it is a first-class deliverable.**

**MUST:**

- One component per file, filename identical to tag name.
- Named exports only. No default exports, no barrel re-exports that rename.
- Explicit return types on every exported function. `strict: true`, `noUncheckedIndexedAccess: true`.
- A JSDoc block on every exported symbol stating what it does and, where it is non-obvious, **why**. Every §2 constraint that shapes a piece of code gets a one-line `// why:` comment at that site. Six months from now the reason a component does not use `innerHTML` must be readable at the call site, not archaeology.
- Descriptive names over short ones. `optionsWithoutOther` beats `opts2`.
- Early returns over nested conditionals. Maximum nesting depth of 3.
- No clever one-liners. No chained ternaries. No bit tricks. If a line needs a comment to explain the syntax rather than the intent, rewrite the line.
- Functions under ~40 lines. If `enhance()` is longer, extract named private methods that read as a sequence: `assignLetterKeys()`, `appendOtherOption()`, `wireNoteToggle()`, `restoreAnswer()`.
- Types in the file that owns them; only genuinely shared types go in `core/types.ts`.

**MUST NOT:**

- Abstract before the third occurrence. Two similar components stay duplicated.
- Add a dependency without recording the reason in `docs/DECISIONS.md`. Current sanctioned runtime deps: Svelte (panel only), Prism (highlighting), Mermaid (diagrams). Nothing else without flagging.

Biome — lint and format in one binary — configured and enforced in CI.

---

## 13. Testing

### 13.1 Vitest in browser mode — MUST

Playwright provider, real Chromium. **jsdom and happy-dom are not options**: neither implements `ElementInternals`, `CustomStateSet`, or the CSS Custom Highlight API, all of which are load-bearing here. A green suite under jsdom would be meaningless.

### 13.2 Coverage required

- **Per component:** upgrade is idempotent (mount twice, assert no duplicate chrome); author children are not moved (capture node identity before and after); parts exist; attributes reflect to state.
- **Numbering:** nested sections produce correct `1.2.1`; letter keys skip correctly; stage numbers start at 0.
- **Slugs:** stable across regeneration; duplicates get suffixes.
- **Store:** namespacing by `doc-id`; two docs in one origin do not collide; unavailable-storage path shows the banner and never throws.
- **Bucket:** round-trip a `FB v1` block through serialise → parse → serialise and assert byte equality against a checked-in golden file.
- **Selection:** a range survives a reload cycle via the anchor scheme.

### 13.3 Kitchen sink fixture

`tests/fixtures/kitchen-sink.html` uses **every** tag, every attribute value, and every preset combination. It is simultaneously:

- the golden-file snapshot target,
- the manual QA page,
- the print/PDF check,
- the example in `REFERENCE.md`.

**MUST** fail CI if a new component lands without being added to it.

### 13.4 Visual regression

Playwright screenshots of the kitchen sink at 390 / 768 / 1280 / 2560px, in light and dark, plus a print snapshot. Small enough to be worth it, and it is the only thing that catches "the accent preset broke callout borders".

---

## 14. Milestones

Ship in this order. Each milestone ends with something demonstrable.

**M1 — Contract and harness.**
`docs/CHEATSHEET.md` with the full tag vocabulary frozen. Validator + CLI. Vite 8 config producing all four artefacts from a stub entry. Layer file. Token file. CI green.
*Demo:* `forgedoc validate` correctly rejects a malformed file.

**M2 — Shell.**
`DocElement`, store, `doc-page`, `doc-header`, `doc-section`, `doc-toc`. Numbering, slugs, TOC, centred layout, presets, dark mode.
*Demo:* a document with only headings and paragraphs already looks like the reference.

**M3 — The 80%.**
`doc-choice` / `doc-option`, `doc-note`, `doc-blocker`, `doc-list`, `doc-compare`, `doc-table`, `doc-code`.
*Demo:* the reference document reproduced except roadmap, flow, and figures.

**M4 — Bucket.**
Selection, highlights, Svelte panel, wire format, persistence, round-trip test.
*Demo:* select text, answer questions, reload, copy — output matches the golden file.

**M5 — Everything else.**
`doc-roadmap`, `doc-flow`, `doc-collapse`, `doc-tabs`, `doc-figure`, `doc-tree`, `doc-diff`, `doc-checklist`, `doc-chips`, `doc-term`, `doc-ref`, `doc-quote`.

**M6 — Polish and publish.**
`print.css`, visual regression suite, `REFERENCE.md`, `SKILL.md`, npm publish, CDN smoke test from a clean machine.

---

## 15. Acceptance criteria

Testable statements. All must hold before v1.0.

1. The reference document is reproduced using **only** library tags — no `<style>`, no `<script>`, no class attributes, no manual ids, no manual numbers — and is visually equivalent.
2. That markup is **under 4,000 tokens**.
3. `forgedoc build` on it produces one `.html` that opens correctly from `file://` on a machine with **no network**, in Chrome, Firefox, and Safari.
4. `Ctrl+F` finds text inside every component, including collapsed and non-active tab content where the browser supports it.
5. Print to PDF produces a clean document: no bucket, expanded disclosures, no box split across a page break.
6. Select text → comment → answer three questions → reload → **all state intact**. Copy produces a valid `FB v1` block.
7. Two different plan files opened from `file://` in the same browser do not see each other's state.
8. Every preset value on every axis renders correctly, in light and dark, at 390 / 768 / 1280 / 2560px.
9. A single line of author CSS outside a layer overrides any shipped rule with no `!important`.
10. The validator catches every error in `tests/fixtures/broken/*.html`, with correct line numbers.
11. Running the runtime twice on the same document changes nothing (idempotent).
12. `docs/CHEATSHEET.md` fits on one printed page.
13. CDN mode works: a plain HTML file with one `<link>` and one `defer` `<script>` renders identically to the injected build.
14. Zero `attachShadow` calls in `src/`. Enforced by a lint rule.

---

## 16. Flag before deciding

Write these into `docs/DECISIONS.md` with your recommendation; do not silently pick.

1. **Section numbers as CSS counters vs. real text.** Counters are cheaper and automatic but not selectable. Default: counters.
2. **Web fonts in the CDN build.** Better typography vs. a second network dependency and a divergence from the offline build. Default: system stack in both.
3. **cdnjs submission.** unpkg and jsdelivr are automatic from npm; cdnjs needs a PR to their repo. Default: defer to v1.1.
4. **`doc-checklist` scope.** Reader-facing ticks only, or also feeding progress into the bucket? Default: local only.
5. **Mermaid version pinning** in the CDN lazy-loader — a floating major will eventually break diagram rendering in already-published plans. Default: pin exact, bump deliberately.
6. **Anything in §2 you believe is wrong.** Those five constraints shape everything downstream. If you find a real problem with one, stop and raise it rather than working around it.
