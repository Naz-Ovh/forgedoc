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
side by side with it and adjust `src/styles/themes/forgedoc/`. No component
logic should need to change, and neither should `src/styles/base/` — every
visual decision lives in the theme's `_tokens.scss`, `_presets.scss` and
`components/*.scss`.

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

### B1. `DocElement.part()` had to be renamed to `findPart()`

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
selector `doc-note [data-part="body"]` still matches and `findPart(el, 'body')`
still resolves; there is simply no extra element. Both MUSTs are satisfied.

**Consequence:** where a component's content is a _bare text node_ — `doc-quote`,
the subtitle of `doc-flow-node`, the title of `doc-header` — there is no element
to name and therefore no part. Those components carry the typography on the host
element instead; see the comments in their stylesheets. This is noted in
`skills/better-plan/REFERENCE.md` per component.

### B3. `doc-collapse` and `doc-stage` do not use `<details>`/`<summary>`

§8.4 asks for `<details>`/`<summary>` "where possible" and says to flag it rather
than silently hand-rolling a div toggle. It is not possible here: `<details>`
requires the collapsible content to be _inside_ it, which means moving every
author node into a generated element (§2.2).

**Resolved as:** `src/core/disclosure.ts`. A generated `<button>` provides the
summary, and the content is hidden with `hidden="until-found"` on the author's own
children — setting an attribute on an existing element, which §2.2 explicitly
allows. The three things `<details>` would have given us are each replaced:

| `<details>` gave us    | Replacement                                       |
|------------------------|---------------------------------------------------|
| Keyboard support       | The summary is a real `<button>`                  |
| Find-in-page expansion | `hidden="until-found"` + the `beforematch` event  |
| Print expansion        | `print.css` force-expands every disclosure (§8.8) |

Browsers without `until-found` treat any value as plain `hidden`, so the
degradation is "collapsed content is not findable", never "content vanishes".

### B4. `doc-code` and `doc-diff` replace their own raw text

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

`doc-tree` is exempted on the same basis: it converts indented text into drawn
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
`__FORGEDOC_DEV__` and dead-code-eliminated from production output.

---

## C. The §16 flag list

### C1. Section numbers: CSS counters vs. real text — **default kept, and made switchable**

Counters are the default, exactly as specified. Because the runtime computes the
outline anyway (for the TOC and for `doc-ref`), rendering real text nodes costs
about fifteen lines, so `doc-page numbering="text"` does it. Counters remain the
default; nothing changes for an author who does not ask.

_Recommendation: leave the default alone. `numbering="text"` exists for the one
reader in fifty who wants to paste "3.1" into a chat window._

### C2. Web fonts in the CDN build — **default kept: system stack in both**

No web fonts ship in either build. Divergence between the CDN and offline builds
is the specific risk §2.3 exists to prevent, and a second network dependency buys
a typographic refinement nobody has asked for.

_Recommendation: keep. An author who wants a web font can set `--doc-font-sans`
and add their own `@font-face`, which is tier 2 of the documented escape hatch._

### C3. cdnjs submission — **default kept: deferred to v1.1**

unpkg and jsDelivr serve from npm automatically and are documented in
`README.md`. cdnjs needs a PR against their repository and is not on the critical
path.

### C4. `doc-checklist` scope — **default kept: local only**

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
|---------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Acceptance 8 (`tests/components/presets.test.ts`) | Derived tokens declared on `:root` are substituted _there_, so `density="compact"` and every subtree token override silently did nothing. The whole scale had to move to `doc-page, doc-page *`.                                                                                                                                                             |
| §13.4 screenshots, dark mode                      | Mermaid rejected every accent token: `getComputedStyle().getPropertyValue()` returns a custom property's _token stream_, so it received the literal text `color-mix(in oklab, …)`. Resolving through a real property then produced `oklab(…)`, which it also rejects. Only `rgb(from … r g b)` works. Every diagram in every dark document was an error box. |
| §13.4 screenshots, 1280px                         | The emphasised-line overlay in `doc-code` is absolutely positioned, so it painted _over_ the code — highlighted lines rendered blank.                                                                                                                                                                                                                        |
| §13.4 screenshots                                 | `doc-diff` never dedented its source, so `+`/`-` were not at the start of a line and every row classified as unchanged context.                                                                                                                                                                                                                              |
| §13.4 screenshots                                 | Inline elements inside a `display: grid` container each become their own grid item, so any roadblock, list item or callout containing `<code>` was torn into separate cells. Four components moved to hanging indents.                                                                                                                                       |
| §13.4 screenshots                                 | An `<li>` keeps `display: list-item` when its parent is a custom element rather than a `<ul>`, so every marked list drew both a UA bullet and its own glyph.                                                                                                                                                                                                 |
| Acceptance 3 (`tests/visual/offline.spec.ts`)     | `window.ForgeDoc.version` was `undefined`. An IIFE wrapper makes the module namespace _be_ the global, so an inner `ForgeDoc` object put the documented `ForgeDoc.chips.add(…)` one hop too deep. The API is now top-level named exports.                                                                                                                    |
| Acceptance 6                                      | `resolveRange` fell back to a stale offset when the quoted text was gone, painting a reader's comment over unrelated prose instead of reporting it orphaned.                                                                                                                                                                                                 |

---

## C8. Reader-driven design changes after the first build

Four changes made in response to watching the built document actually being used.
Each one is a behaviour change, not a repaint, so each is recorded here.

### C8.1 The contents panel floats and starts collapsed, and can be docked

The panel was appended without `data-doc-chrome`. That is the marker the reading
column rule opts out on — and `doc-page > *:not([data-doc-chrome])` at (0,1,1)
out-specifies `doc-toc` at (0,0,1), so its `max-width: 15rem` never applied and
a "narrow rail" rendered at 90% of the viewport, covering the document behind it.

Fixing the width alone was not enough, because the panel also opened itself on
load at ≥1280px: the first thing a reader saw was a list of section names on top
of the section they had opened the file to read. It now starts **floating and
collapsed** at every width, and the reader chooses between two modes from a
control in its own header:

- **floating** — a full-height overlay. Escape closes it, and so does clicking an
  entry, because it is covering the thing it just scrolled to.
- **docked** — pinned to the edge, pushing the reading column across.

Docking is done by adding `padding-inline-start` to `doc-page`, not by wrapping
anything: the column is `doc-page > *` with `margin-inline: auto`, so widening
the start padding both clears the rail and re-centres the content in the space
that is left. §2.2 holds — nothing is reparented and there is no wrapper element.

Docking implies open and collapsing implies floating, resolved in one place
(`DocPage#setToc`) rather than at each call site. The viewport is consulted
exactly once, when a _remembered or authored_ `docked` is applied at mount: below
the dock breakpoint there is no column for a rail to occupy, so honouring it
literally would reopen the full-screen overlay this change exists to remove. The
reader's own toggles are never width-checked, because `toc.css` hides the dock
control below that width.

### C8.2 The comment composer could not be typed into

`watchSelection` listens on `document`, and the composer renders _inside_
`doc-page`. Clicking its textarea is therefore a `pointerup` inside the document
with a collapsed selection — which the watcher read as "the reader deselected
everything" and used to dismiss the composer. The feature was unusable: the box
vanished on the first click into it, every time.

Every part of the bucket now carries `data-doc-ui`, and the watcher ignores
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
`doc-figure`, `doc-code`, `doc-diff` and `doc-tree` now append a `feedback`
part that dispatches one bubbling `doc-block-feedback` event; the bucket listens
on `doc-page`. Neither side knows about the other.

A block comment carries `scope: 'block'`, and everything downstream branches on
it: the anchor is the element rather than a character range, it is painted as an
outline rather than a highlight, it is orphaned only when its element is gone,
and it is never resolved as a range — doing so fell through to a quote search
that matched the composer's own label. The wire format is unchanged: the `>`
line carries a descriptor (`doc-figure · Store shape`) instead of an excerpt,
which `skills/better-plan/SKILL.md` now tells the reading agent to resolve by.

---

## D. Additive decisions

Small choices not covered by the specification.

| Decision                                                                                                                   | Reasoning                                                                                                                                                                                                                                                                                                                                                                            |
|----------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `forgedoc build` defaults to the **standalone** bundle; `--cdn` selects the lighter one. `--standalone` is still accepted. | §5.3 promises `forgedoc build DOC_foo.html` produces a file with "no network, no CDN, no dependencies". Only the standalone bundle keeps that promise, so it is the default.                                                                                                                                                                                                         |
| Storage key is `forgedoc:<doc-id>:state`.                                                                                  | §9.3 specifies `forgedoc:<doc-id>:<field>`; §9.1 specifies one blob. `state` is the one field.                                                                                                                                                                                                                                                                                       |
| `doc-page` accepts `numbering` and `doc-figure` accepts `alt`.                                                             | `numbering` implements C1. `alt` is needed for `type="image"` to be accessible at all.                                                                                                                                                                                                                                                                                               |
| `doc-list` accepts `title` and `kind`.                                                                                     | §8.6 requires them for `doc-compare` columns, but §8.3 lists only `marker`.                                                                                                                                                                                                                                                                                                          |
| `doc-page` sets `role="article"` and takes its label from the header title.                                                | §2.2 blocks a `heading` role on `doc-header` — the title is a bare text node beside the lede, and a heading whose accessible name swallowed the lede would be worse than none. Section headings still provide navigation.                                                                                                                                                            |
| Derived tokens are declared on `doc-page, doc-page *`, primitives on `:root, doc-page`.                                    | A `var()` inside a custom property is substituted where it is _declared_. Declaring the whole scale on `:root` bakes in the root's unit, so `density="compact"` and `<doc-table style="--doc-space-unit:9px">` would both silently do nothing. This was caught by `tests/components/presets.test.ts`. The cost is a universal selector carrying ~30 declarations, paid deliberately. |

---

## F. The base/theme split

§4.3 and §6.4 describe one stylesheet built from one token set, using
`light-dark()` so a document follows the reader's colour scheme. That is still
true of any _single_ build. What changed is that there is now more than one
possible token set, because the library is growing a family of themes
(`forgedoc`, and `geist` / `mintlify` / `vite` / `notion` to follow) rather than
one look with an accent knob.

### F1. A theme is chosen at build time, not at runtime

`forgedoc build --theme <name>` compiles exactly one theme into the document,
and the document can name its own in the placeholder —
`<style>/_@DOC_CSS:geist@_/</style>` — so the choice travels with the file and a
rebuild months later produces the same thing. The flag overrides it.

why not a runtime switch: a document ships one stylesheet. Shipping five so the
reader can pick would send four they never see, and the CDN flavour's whole
argument is that a plan stays a few kB in git. It also keeps the Mermaid theming
honest — `vendor/mermaid.ts` reads the resolved `--doc-*` tokens once, at first
render, which is correct precisely because they cannot change afterwards.

### F2. `base/` is headless; the theme owns everything visual

`src/styles/base/` holds structure and behaviour. `src/styles/themes/<name>/`
holds colour, sizing, spacing and typography. The partition is by **property
name** — the list is `tools/style-properties.mjs` — and never by how a value
looks, because "is `14px` a size or a layout constant?" is a judgement call and
judgement calls rot. Grid _track definitions_ stay in base for the same reason:
`grid-template-columns` describes structure even though it carries lengths.

Measured on the 23 component stylesheets at the time of the split: 1,355
declarations, of which 324 were structural and 1,031 visual. Roughly one in
four.

why not a full copy per theme, which was the first instinct: the structural
quarter is the half that carries the bugs worth fixing once — focus order, print
behaviour, reduced motion, RTL, `hidden="until-found"`. Five copies means fixing
each of those five times, and four of the copies drift. A theme that genuinely
needs different structure overrides it from `doc.theme` instead, which outranks
everything base ships.

### F3. `doc.theme` sits between `doc.components` and `doc.utilities`

That single position is the whole override story: a theme rule beats the
matching base rule at equal or lower specificity, so a theme never needs
`!important` and never has to reproduce a base selector just to outrank it. It
is deliberately _before_ `doc.utilities`, because the author's own per-document
escape hatch must still win over whichever theme was compiled in, and unlayered
author CSS still beats all of it (§4.4).

The reset and prose layers do **not** move. `doc.reset` exists to be beaten — it
zeroes `margin` on every heading so components can set their own — and promoting
its theme half to the last layer would invert that. A theme owns the _values_ in
those layers; it does not get to move them up the cascade.

### F4. The boundary is enforced, not documented

`npm run lint` runs `tools/check-style-layers.mjs`, which fails if a visual
property or a colour literal appears in `base/`, or if a theme is missing a token
the reference theme declares. Both failures are silent otherwise: the first looks
completely fine until someone writes the second theme and one component refuses
to change; the second renders a component against `unset`, which usually means
invisible text on exactly one component.

### F5. The split was verified against the pre-split render

The migration moved ~1,300 declarations between files, which no unit test would
have caught. It was checked by loading the kitchen sink twice in Chromium — once
with the compiled theme, once with the stylesheet reconstructed from the previous
commit — and diffing every computed property of all 840 elements, in both colour
schemes. It found one real regression (a token rewritten into a self-reference)
and, once fixed, reported the two renders identical.

### F6. The `geist` theme, and the two rules it bends

`themes/geist/` is the first theme that is not the reference, and building it
was the real test of whether the split works. It does: the theme is a token
file, a preset file, and the visual layer — `base/` was not touched once.

Two departures worth recording.

**§6.5, "no web fonts ship in either build."** Geist rendered in a system
grotesque is a different design, so this theme loads its own typefaces:
Google Fonts first, a version-pinned jsDelivr copy second. The fallback is the
_font stack_ rather than a multi-`url()` `src`, because Google's gstatic URLs
carry a content hash that changes when they re-cut the font — asking for their
stylesheet keeps that indirection on their side, and giving the jsDelivr copy a
different family name stops the two `@font-face` rules from shadowing each
other. Consequence: an `--offline` document in this theme renders in the system
stack. Inlining the woff2 as base64 was built and then removed; it worked and
kept the offline promise, but cost ~190 kB on a 68 kB stylesheet.

**Vercel's published brand colours, at the 600 step.** White on `#f5a623` is
2.0:1 and on `#e5484d` is 3.9:1. That is not a mistake in Geist — those are its
700 "high contrast background" step and the ink on them is dark, not white. Our
contract has one 600 step doing both jobs, so the ramps here deepen it until it
carries white, and the brand hex keeps its place at 400 where it is used for
borders and dark-mode lines. Changing the contract instead would have meant
changing it for every theme.

### F7. Two bugs the second theme exposed

Neither was introduced by the split; both had been there and were invisible
while only one palette existed.

**The page frame resolved `light-dark()` in the wrong scheme.** `color-scheme`
was declared on `doc-page`, but the `html:has(doc-page)` and `body:has(doc-page)`
background rules sit outside it, so `<html>` computed `color-scheme: normal` and
took the _light_ value of every token — in dark mode it painted the frame
near-white behind a dark document, visible in the overscroll area and behind the
scrollbar. `forgedoc` hid it because its light and dark surfaces are both muted;
`geist` made it obvious the moment the page went pure black. Fixed in both
themes by claiming the scheme on `html:has(doc-page)`, kept behind `:has()` so
the CDN build still cannot restyle a host page's scrollbars.

**Contrast that was never measured.** Sweeping every text run against its real
backdrop found 60 sub-AA pairs in `forgedoc` light and 25 in dark — line
numbers at 2.6:1, flow-node subtitles at 4.3:1, white glyphs on the amber and
green solids. `geist` was brought to 0 as it was built. The `forgedoc` numbers
are recorded here rather than fixed, because changing them changes the
reference theme's appearance and that is a separate decision.

### F8. The collapsed disclosure is a row, not a card

`geist` gives `doc-collapse` 8px of vertical padding, small text and no fill
until hover: 33px closed against `forgedoc`'s 51px. A closed disclosure is a
line in a list — the reader is scanning titles — and five of them at card
height cost most of a screen. The open state keeps its full padding; nothing is
gained by cramping prose once the reader has committed to it.

---

## E. Dependencies

§12 requires a recorded reason for every dependency. Sanctioned by the
specification: Svelte (panel only), Prism (highlighting), Mermaid (diagrams).

| Package                | Where         | Reason                                                                                                                                                                                                                                                                                                |
|------------------------|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `svelte`               | dev           | Compiled away. Bundled output only, so it is not a runtime dependency of the published package. Used **only** for the bucket panel (§10.1).                                                                                                                                                           |
| `prismjs`              | dev           | Bundled into all three JS artefacts. Shiki is ruled out by §8.6 — WASM plus grammars is far too heavy for a self-contained file.                                                                                                                                                                      |
| `mermaid`              | optional peer | External in the ESM build, bundled in standalone, lazily fetched in the CDN build. Declared optional so a consumer who never writes a `type="mermaid"` figure never installs 1 MB.                                                                                                                    |
| `parse5`               | dev           | Sanctioned by §11.2. Chosen over `linkedom` — the other option §11.2 offers — because it exposes `sourceCodeLocation`, and acceptance criterion 10 requires **correct line numbers**. linkedom does not provide source positions. Bundled into `dist/cli.js`, so it never reaches a browser consumer. |
| `tsdown`               | dev           | Builds every shipped artefact — the three runtime variants, `dist/cli.js` and the declarations — from one `tsdown.config.ts`. Vite is kept for the dev server and Vitest only, and no longer writes to `dist/`.                                                                                       |
| `rolldown`             | dev           | The engine under both Vite 8 and tsdown. Declared explicitly because `tools/gen-reference.mjs` imports it directly to load the TypeScript contract.                                                                                                                                                   |
| `rollup-plugin-svelte` | dev           | Compiles the three `.svelte` files under tsdown. `@sveltejs/vite-plugin-svelte` needs Vite's resolved config and throws outside it, so the Vite dev server and the tsdown build use different Svelte plugins.                                                                                         |
| `@tsdown/css`          | dev           | tsdown's CSS support is opt-in and ships separately. It inlines the ordered `@import` graph in `styles/index.css` into one `forgedoc.css`, preserving `@layer` order (§4.3, §4.4).                                                                                                                    |

### Package identity

Published to npm as **`forgedoc`**, matching the CLI binary, the IIFE global
`ForgeDoc`, the built files (`forgedoc.css` / `forgedoc.iife.js`), the repository
and the CDN path. The package was briefly named `better-plan`; the mismatch
against everything else was the reason to change it before 1.0.0 rather than
after, since the name is baked into every published CDN URL.

The skill installed by `npx skills add` stays **`better-plan`**. It is a
separate artefact with a separate audience — an agent installs the skill, a
human installs the package — and `skills/better-plan/` is the path the skills
CLI resolves, which the CI workflow asserts on directly when it is run.

> **Known collision, accepted.** `forgedoc-cli` (unrelated, published 2026-07-25)
> declares `bin: { forgedoc: … }`, so a machine with both installed globally gets
> whichever landed last. The npm package name `forgedoc` was unregistered and is
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

**Markdown is linted by configuration, not by a formatter.** With no formatter
owning `.md`, each contributor's editor formatted on its own defaults, and the
files drifted into two table styles at once — Prettier's width-padded delimiters
in `README.md` and this file, tight `|---|` rows in `docs/PLAN.md` and the
generated reference. That cost a real debugging session: opening
`skills/better-plan/REFERENCE.md` in an editor with markdownlint's fix-on-save
rewrote 15 delimiter rows, which failed `tests/node/reference.test.ts` — a
staleness check on a generated file — with a diff that looked like whitespace
noise and named no cause.

`.markdownlint-cli2.jsonc` settles it. Every table now uses the `| --- |` row
that markdownlint's own fixer produces, `tools/gen-reference.mjs` emits that
shape too, and three rules are off because the docs deliberately break them:
`MD013` (the specification is one line per paragraph, so a changed requirement is
a one-line diff), `MD026` (the §2 constraint headings are complete sentences) and
`MD036` (`**Attributes**` labels the block under it and must not enter the
heading numbering the `§` references depend on). Opening a file in an editor now
changes nothing.

**Biome does not format `tests/fixtures/`.** The content of `doc-code`,
`doc-diff` and `doc-tree` is rendered verbatim, and the validator tests assert
exact line numbers. Formatting those files once collapsed a `doc-tree` onto a
single line and shifted every diagnostic in `tests/node/validate.test.ts`.
The related trap — a formatter splitting `<style>/*@DOC_CSS@*/</style>` across
lines in the documentation, shipping a snippet that cannot be built — is now
covered by Biome having no Markdown formatter at all rather than by Prettier's
`embeddedLanguageFormatting: "off"`.
