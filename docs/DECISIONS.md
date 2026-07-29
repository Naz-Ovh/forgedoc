# DECISIONS

Open questions, flagged deviations and dependency justifications, as required by
`docs/PLAN.md` §0, §12 and §16.

Everything below was **implemented with the stated default** unless it says
otherwise. Nothing here is blocking.

---

## A. Missing inputs the specification refers to

Two artefacts the spec treats as existing were not present in the repository at
the start of this build. Both are called out because the work below is a
reconstruction, and a real copy should be diffed against it.

### A1. The visual reference prototype (§1.3)

**Status:** not present. `PLAN.md` (now `docs/PLAN.md`) was the only file in the
repository.

§1.3 says a prototype "already produces the exact intended look" and forbids
redesigning it. With no prototype to read, the visual language was reconstructed
from the prose description in §1.3 plus every visual MUST scattered through §6
and §8: dense but airy editorial layout, teal accent, generous line-height,
prominent hierarchical section numbers, two-column compare panels, coloured
callouts, a numbered roadmap of collapsible stages, question cards with lettered
options, and a floating feedback bucket.

**What to do with the real prototype:** open `tests/fixtures/kitchen-sink.html`
side by side with it and adjust `src/styles/`. No component logic should need to
change — every visual decision lives in `src/styles/tokens.css`,
`src/styles/presets.css` and `src/styles/components/*.css`.

### A2. `bucket_format.txt` (§10.3)

**Status:** not present. §10.3 says to "locate the current `bucket_format.txt`,
treat it as the spec, and write a round-trip test."

The format was reconstructed from the rules §10.3 _does_ state: the block begins
`=== FB v1 ·`; answers serialise question text and chosen option labels verbatim;
the note serialises as `n:` and is omitted when empty; an Other answer serialises
the reader's typed text as the answer label. The concrete grammar now lives in
`src/bucket/serialize.ts`, with `tests/golden/bucket-v1.txt` as the checked-in
specimen and a byte-equality round-trip test.

**Risk:** if a real `bucket_format.txt` exists, buckets collected against the
prototype may not parse. The fix is to adjust `serialize.ts` and regenerate the
golden file; the parser already reports a malformed item without discarding the
rest, so a mismatch degrades loudly rather than silently.

---

## B. Flagged deviations from a MUST

Each of these follows §0: the constraint was honoured, and the cost is recorded
here rather than being quietly worked around.

### B1. `PlanElement.part()` had to be renamed to `findPart()`

§7.1 specifies `protected part(name: string)`. `Element.part` already exists in
the DOM as a `DOMTokenList` (the shadow-parts attribute reflection), and
TypeScript correctly refuses to let a subclass narrow a public property into a
protected method.

**Resolved as:** `findPart(name)` and `findParts(name)`. Behaviour is exactly as
specified, including the §7.4 scoping rule. Nothing about the public `data-part`
surface changed.

### B2. `data-part="body"` names the author's children rather than wrapping them

§7.3's example CSS selects `[data-part="body"]` inside a component, which implies
a generated wrapper element around the author's content. Creating that wrapper
would require moving author nodes into it — precisely what §2.2 forbids.

**Resolved as:** `nameAuthorContent()` in `src/core/parts.ts` sets
`data-part="body"` on the author's own direct children, in place. The documented
selector `plan-note [data-part="body"]` still matches and `findPart(el, 'body')`
still resolves; there is simply no extra element. Both MUSTs are satisfied.

**Consequence:** where a component's content is a _bare text node_ — `plan-quote`,
the subtitle of `plan-flow-node`, the title of `plan-header` — there is no element
to name and therefore no part. Those components carry the typography on the host
element instead; see the comments in their stylesheets. This is noted in
`skills/better-plan/REFERENCE.md` per component.

### B3. `plan-collapse` and `plan-stage` do not use `<details>`/`<summary>`

§8.4 asks for `<details>`/`<summary>` "where possible" and says to flag it rather
than silently hand-rolling a div toggle. It is not possible here: `<details>`
requires the collapsible content to be _inside_ it, which means moving every
author node into a generated element (§2.2).

**Resolved as:** `src/core/disclosure.ts`. A generated `<button>` provides the
summary, and the content is hidden with `hidden="until-found"` on the author's own
children — setting an attribute on an existing element, which §2.2 explicitly
allows. The three things `<details>` would have given us are each replaced:

| `<details>` gave us    | Replacement                                       |
| ---------------------- | ------------------------------------------------- |
| Keyboard support       | The summary is a real `<button>`                  |
| Find-in-page expansion | `hidden="until-found"` + the `beforematch` event  |
| Print expansion        | `print.css` force-expands every disclosure (§8.8) |

Browsers without `until-found` treat any value as plain `hidden`, so the
degradation is "collapsed content is not findable", never "content vanishes".

### B4. `plan-code` and `plan-diff` replace their own raw text

These two are the only components that touch author content. Syntax highlighting
_is_ the substitution of markup for text; there is no version of it that leaves
the original text nodes in place.

**Why this is safe here specifically:** Prism preserves `textContent` byte for
byte, and every feedback anchor resolves by anchor id plus a character offset into
`textContent` (plus a quoted excerpt as a second locator). The failure mode §2.2
guards against — an invalidated live `Range` — cannot occur, because highlight
restore runs _after_ mount, not before it. `tests/components/upgrade.test.ts`
exempts exactly these two components from the node-identity assertion and no
others.

`plan-tree` is exempted on the same basis: it converts indented text into drawn
connectors, which is the whole point of the tag.

### B5. The in-page dev banner is a second, DOM-based checker

§11.3 asks for violations rendered as a banner with the "same rule ids, same
messages". §11.2 requires the Node validator to parse raw HTML with parse5 to
report real line numbers.

**Resolved as:** `src/core/dev-report.ts` walks the live DOM, shares the same
`src/core/contract.ts` table, and emits the same rule ids. It reports the
offending _element_ rather than a line number, because the DOM has no line
numbers and shipping an HTML parser into the browser to re-parse a document the
browser already parsed would be absurd. The whole module is gated on
`__PLANKIT_DEV__` and dead-code-eliminated from production output.

---

## C. The §16 flag list

### C1. Section numbers: CSS counters vs. real text — **default kept, and made switchable**

Counters are the default, exactly as specified. Because the runtime computes the
outline anyway (for the TOC and for `plan-ref`), rendering real text nodes costs
about fifteen lines, so `plan-doc numbering="text"` does it. Counters remain the
default; nothing changes for an author who does not ask.

_Recommendation: leave the default alone. `numbering="text"` exists for the one
reader in fifty who wants to paste "3.1" into a chat window._

### C2. Web fonts in the CDN build — **default kept: system stack in both**

No web fonts ship in either build. Divergence between the CDN and offline builds
is the specific risk §2.3 exists to prevent, and a second network dependency buys
a typographic refinement nobody has asked for.

_Recommendation: keep. An author who wants a web font can set `--plan-font-sans`
and add their own `@font-face`, which is tier 2 of the documented escape hatch._

### C3. cdnjs submission — **default kept: deferred to v1.1**

unpkg and jsDelivr serve from npm automatically and are documented in
`README.md`. cdnjs needs a PR against their repository and is not on the critical
path.

### C4. `plan-checklist` scope — **default kept: local only**

Ticks persist in the store and are deliberately _not_ serialised into the bucket.

_Reasoning: a tick is a reading aid — "I have verified this myself" — not an
answer to a question the agent asked. Feeding them into the bucket would put
noise in front of the agent that it has no instruction for, and §10.3's receipt
rules have nothing to say about a half-ticked list. Reversing this is a five-line
change in `src/bucket/collect.ts` if the reader-progress signal turns out to be
wanted._

### C5. Mermaid version pinning — **default kept: pinned exactly**

`src/vendor/mermaid-source.cdn.ts` pins `mermaid@11.16.0` in the URL. A floating
major would eventually break diagram rendering in plans that were published and
signed off months earlier — the worst kind of regression, because nobody is
watching for it. Bumping it is a one-line change plus a rebuild.

### C6. Anything in §2 believed to be wrong — **nothing**

All five constraints held up under implementation. Two are worth recording as
load-bearing rather than merely defensible:

- **§2.1 (no shadow DOM)** paid for itself immediately. `window.getSelection()`
  works unqualified across the whole document, and the CSS Custom Highlight API
  paints ranges with no per-root bookkeeping. Nothing in the library wanted a
  shadow root.
- **§2.5 (no framework for the elements)** was correct for the stated reason. The
  one place Svelte _is_ used — the bucket — has no author content in it at all,
  which is exactly the line §2.5 draws.

§2.2 is the constraint that cost the most (see B2, B3, B4), and it is still the
right call: the node-identity assertion in `tests/components/upgrade.test.ts`
would be impossible to satisfy under any of the alternatives, and that assertion
is what guarantees a reader's highlights survive.

---

## C7. Bugs the spec's own acceptance criteria caught

Recorded because each one was invisible in code review and only surfaced when the
criterion was actually executed. Every one now has a regression test.

| Found by                                          | Bug                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acceptance 8 (`tests/components/presets.test.ts`) | Derived tokens declared on `:root` are substituted _there_, so `density="compact"` and every subtree token override silently did nothing. The whole scale had to move to `plan-doc, plan-doc *`.                                                                                                                                                             |
| §13.4 screenshots, dark mode                      | Mermaid rejected every accent token: `getComputedStyle().getPropertyValue()` returns a custom property's _token stream_, so it received the literal text `color-mix(in oklab, …)`. Resolving through a real property then produced `oklab(…)`, which it also rejects. Only `rgb(from … r g b)` works. Every diagram in every dark document was an error box. |
| §13.4 screenshots, 1280px                         | The emphasised-line overlay in `plan-code` is absolutely positioned, so it painted _over_ the code — highlighted lines rendered blank.                                                                                                                                                                                                                       |
| §13.4 screenshots                                 | `plan-diff` never dedented its source, so `+`/`-` were not at the start of a line and every row classified as unchanged context.                                                                                                                                                                                                                             |
| §13.4 screenshots                                 | Inline elements inside a `display: grid` container each become their own grid item, so any roadblock, list item or callout containing `<code>` was torn into separate cells. Four components moved to hanging indents.                                                                                                                                       |
| §13.4 screenshots                                 | An `<li>` keeps `display: list-item` when its parent is a custom element rather than a `<ul>`, so every marked list drew both a UA bullet and its own glyph.                                                                                                                                                                                                 |
| Acceptance 3 (`tests/visual/offline.spec.ts`)     | `window.PlanKit.version` was `undefined`. An IIFE wrapper makes the module namespace _be_ the global, so an inner `PlanKit` object put the documented `PlanKit.chips.add(…)` one hop too deep. The API is now top-level named exports.                                                                                                                   |
| Acceptance 6                                      | `resolveRange` fell back to a stale offset when the quoted text was gone, painting a reader's comment over unrelated prose instead of reporting it orphaned.                                                                                                                                                                                                 |

---

## C8. Reader-driven design changes after the first build

Four changes made in response to watching the built document actually being used.
Each one is a behaviour change, not a repaint, so each is recorded here.

### C8.1 The contents panel floats and starts collapsed, and can be docked

The panel was appended without `data-plan-chrome`. That is the marker the reading
column rule opts out on — and `plan-doc > *:not([data-plan-chrome])` at (0,1,1)
out-specifies `plan-toc` at (0,0,1), so its `max-width: 15rem` never applied and
a "narrow rail" rendered at 90% of the viewport, covering the document behind it.

Fixing the width alone was not enough, because the panel also opened itself on
load at ≥1280px: the first thing a reader saw was a list of section names on top
of the section they had opened the file to read. It now starts **floating and
collapsed** at every width, and the reader chooses between two modes from a
control in its own header:

- **floating** — a full-height overlay. Escape closes it, and so does clicking an
  entry, because it is covering the thing it just scrolled to.
- **docked** — pinned to the edge, pushing the reading column across.

Docking is done by adding `padding-inline-start` to `plan-doc`, not by wrapping
anything: the column is `plan-doc > *` with `margin-inline: auto`, so widening
the start padding both clears the rail and re-centres the content in the space
that is left. §2.2 holds — nothing is reparented and there is no wrapper element.

Docking implies open and collapsing implies floating, resolved in one place
(`PlanDoc#setToc`) rather than at each call site. The viewport is consulted
exactly once, when a _remembered or authored_ `docked` is applied at mount: below
the dock breakpoint there is no column for a rail to occupy, so honouring it
literally would reopen the full-screen overlay this change exists to remove. The
reader's own toggles are never width-checked, because `toc.css` hides the dock
control below that width.

### C8.2 The comment composer could not be typed into

`watchSelection` listens on `document`, and the composer renders _inside_
`plan-doc`. Clicking its textarea is therefore a `pointerup` inside the document
with a collapsed selection — which the watcher read as "the reader deselected
everything" and used to dismiss the composer. The feature was unusable: the box
vanished on the first click into it, every time.

Every part of the bucket now carries `data-plan-ui`, and the watcher ignores
events originating inside it. Three things follow from the same marker:

- `textNodesOf` skips the bucket too, so a comment whose offsets have shifted can
  no longer match its own quote in the review panel and paint a highlight onto
  the bucket instead of the document.
- The composer autofocuses. Focusing collapses the document selection, so the
  pending range is painted as an active highlight while composing — otherwise the
  reader loses sight of the text they are writing about.
- The textarea resizes on both axes, and the popover is `width: max-content` so
  it grows with it. Its start offset is clamped to the viewport, because a
  block's Comment button sits in the block's _right_ corner and anchoring to it
  put the Add comment button off the edge of the window.

### C8.3 Clicking a collected item opens a detail window

It used to scroll the document to the anchor, which loses the panel, loses the
reader's place, and answers the wrong question. Someone reviewing their own
feedback is comparing two things — what the document says and what they said
about it — and that comparison needs both on screen at once.

The window shows the quote in its surrounding paragraph (read live from the DOM,
so a regenerated document shows what it says _now_) beside the reader's comment;
for an answer it shows every option with the chosen ones marked, which is the one
thing the panel listing cannot show. Jumping to the document is still available,
as an action rather than as the default.

### C8.4 Blocks with no selectable text get their own Comment button

A rendered Mermaid chart, an `<img>` or an `<svg>` contains nothing to select, so
a reader could comment on every sentence of a plan and on none of its diagrams.
`plan-figure`, `plan-code`, `plan-diff` and `plan-tree` now append a `feedback`
part that dispatches one bubbling `plan-block-feedback` event; the bucket listens
on `plan-doc`. Neither side knows about the other.

A block comment carries `scope: 'block'`, and everything downstream branches on
it: the anchor is the element rather than a character range, it is painted as an
outline rather than a highlight, it is orphaned only when its element is gone,
and it is never resolved as a range — doing so fell through to a quote search
that matched the composer's own label. The wire format is unchanged: the `> `
line carries a descriptor (`plan-figure · Store shape`) instead of an excerpt,
which `skills/better-plan/SKILL.md` now tells the reading agent to resolve by.

---

## D. Additive decisions

Small choices not covered by the specification.

| Decision                                                                                                                  | Reasoning                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plankit build` defaults to the **standalone** bundle; `--cdn` selects the lighter one. `--standalone` is still accepted. | §5.3 promises `plankit build PLAN_foo.html` produces a file with "no network, no CDN, no dependencies". Only the standalone bundle keeps that promise, so it is the default.                                                                                                                                                                                                           |
| Storage key is `plankit:<plan-id>:state`.                                                                                 | §9.3 specifies `plankit:<plan-id>:<field>`; §9.1 specifies one blob. `state` is the one field.                                                                                                                                                                                                                                                                                         |
| `plan-doc` accepts `numbering` and `plan-figure` accepts `alt`.                                                           | `numbering` implements C1. `alt` is needed for `type="image"` to be accessible at all.                                                                                                                                                                                                                                                                                                 |
| `plan-list` accepts `title` and `kind`.                                                                                   | §8.6 requires them for `plan-compare` columns, but §8.3 lists only `marker`.                                                                                                                                                                                                                                                                                                           |
| `plan-doc` sets `role="article"` and takes its label from the header title.                                               | §2.2 blocks a `heading` role on `plan-header` — the title is a bare text node beside the lede, and a heading whose accessible name swallowed the lede would be worse than none. Section headings still provide navigation.                                                                                                                                                             |
| Derived tokens are declared on `plan-doc, plan-doc *`, primitives on `:root, plan-doc`.                                   | A `var()` inside a custom property is substituted where it is _declared_. Declaring the whole scale on `:root` bakes in the root's unit, so `density="compact"` and `<plan-table style="--plan-space-unit:9px">` would both silently do nothing. This was caught by `tests/components/presets.test.ts`. The cost is a universal selector carrying ~30 declarations, paid deliberately. |

---

## E. Dependencies

§12 requires a recorded reason for every dependency. Sanctioned by the
specification: Svelte (panel only), Prism (highlighting), Mermaid (diagrams).

| Package                | Where         | Reason                                                                                                                                                                                                                                                                                                |
| ---------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `svelte`               | dev           | Compiled away. Bundled output only, so it is not a runtime dependency of the published package. Used **only** for the bucket panel (§10.1).                                                                                                                                                           |
| `prismjs`              | dev           | Bundled into all three JS artefacts. Shiki is ruled out by §8.6 — WASM plus grammars is far too heavy for a self-contained file.                                                                                                                                                                      |
| `mermaid`              | optional peer | External in the ESM build, bundled in standalone, lazily fetched in the CDN build. Declared optional so a consumer who never writes a `type="mermaid"` figure never installs 1 MB.                                                                                                                    |
| `parse5`               | dev           | Sanctioned by §11.2. Chosen over `linkedom` — the other option §11.2 offers — because it exposes `sourceCodeLocation`, and acceptance criterion 10 requires **correct line numbers**. linkedom does not provide source positions. Bundled into `dist/cli.js`, so it never reaches a browser consumer. |
| `tsdown`               | dev           | Builds every shipped artefact — the three runtime variants, `dist/cli.js` and the declarations — from one `tsdown.config.ts`. Vite is kept for the dev server and Vitest only, and no longer writes to `dist/`.                                                                                       |
| `rolldown`             | dev           | The engine under both Vite 8 and tsdown. Declared explicitly because `tools/gen-reference.mjs` imports it directly to load the TypeScript contract.                                                                                                                                                   |
| `rollup-plugin-svelte` | dev           | Compiles the three `.svelte` files under tsdown. `@sveltejs/vite-plugin-svelte` needs Vite's resolved config and throws outside it, so the Vite dev server and the tsdown build use different Svelte plugins.                                                                                         |
| `@tsdown/css`          | dev           | tsdown's CSS support is opt-in and ships separately. It inlines the ordered `@import` graph in `styles/index.css` into one `plankit.css`, preserving `@layer` order (§4.3, §4.4).                                                                                                                     |

### Package identity

Published to npm as **`plankit`**, matching the CLI binary, the IIFE global
`PlanKit`, the built files (`plankit.css` / `plankit.iife.js`), the repository
and the CDN path. The package was briefly named `better-plan`; the mismatch
against everything else was the reason to change it before 1.0.0 rather than
after, since the name is baked into every published CDN URL.

The skill installed by `npx skills add` stays **`better-plan`**. It is a
separate artefact with a separate audience — an agent installs the skill, a
human installs the package — and `skills/better-plan/` is the path the skills
CLI resolves, which CI asserts on directly.

> **Known collision, accepted.** `plankit-cli` (unrelated, published 2026-07-25)
> declares `bin: { plankit: … }`, so a machine with both installed globally gets
> whichever landed last. The npm package name `plankit` was unregistered and is
> ours; the command name is not exclusive and cannot be made so. Revisit if it
> generates real confusion.

`@playwright/test` is also a dev dependency: it runs the visual regression suite
and the `file://` acceptance tests (§13.4), separately from the `playwright`
package Vitest's browser provider uses.

No other runtime dependency was added.

### Two tooling exclusions

Both are recorded here rather than buried in a dotfile, because each is a place
where automation is deliberately _not_ applied.

**Biome does not format `*.svelte`.** Biome 2.5.6's Svelte support is partial —
it parses the `<script>` block and never the template. Asked to format
`BucketItem.svelte` it hoisted the `interface Props` block above its own doc
comment and dedented the whole script body. That is the same class of breakage
that kept `prettier-plugin-svelte@4.1.1` out before it (it failed on Svelte
5.56's AST with `unknown node type: Script`), so these three files remain
hand-formatted. Revisit when Svelte support leaves partial.

**Biome does not lint Svelte templates either.** `noUnusedVariables` and
`noUnusedImports` are off for `*.svelte`, because every `$props()` binding and
every child component is referenced only from markup Biome cannot see.
`eslint-plugin-svelte` did understand templates; nothing replaces that today.
`npm run lint:no-shadow` still scans `.svelte` for the one rule that must never
regress (§2.1), and `svelte-check` is the way back if template linting is wanted.

**Biome does not format Markdown.** Biome 2.5.6 has no Markdown support at all —
it reports "Checked 0 files" for `README.md`. Prettier used to format every `.md`
in the repository. The prose is hand-wrapped and reads the same either way, so
this is recorded as a known gap rather than a reason to keep a second formatter.

**Biome does not format `tests/fixtures/`.** The content of `plan-code`,
`plan-diff` and `plan-tree` is rendered verbatim, and the validator tests assert
exact line numbers. Formatting those files once collapsed a `plan-tree` onto a
single line and shifted every diagnostic in `tests/node/validate.test.ts`.
The related trap — a formatter splitting `<style>/*@PLAN_CSS@*/</style>` across
lines in the documentation, shipping a snippet that cannot be built — is now
covered by Biome having no Markdown formatter at all rather than by Prettier's
`embeddedLanguageFormatting: "off"`.
