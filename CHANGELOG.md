# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.0] - 2026-10-21

Plans that explain by showing. A reader stuck on "what actually happens here?"
can now press Play and watch it, and an agent with an idea no element fits can
build its own block without breaking out of the runtime.

### Added

- **A documentation handbook** at [forgedoc.naz.ovh](https://forgedoc.naz.ovh),
  with installation, tutorials, runtime API, component references and Markdown
  pages for coding agents.
- **`doc-walkthrough`, an animated scene player.** The author writes actors
  (`doc-actor`) and scenes (`doc-scene`); each scene moves a token between two
  actors (`doc-move`, with an optional `accept` / `reject` outcome) or changes
  one (`doc-change`: add or strike a row, set a status, drop the actor). The
  runtime draws the stage, flies the tokens along curved arrows, accumulates
  changes scene by scene, and adds Play / Prev / Next, a dot per scene, arrow
  keys and a plain-text transcript. Under `prefers-reduced-motion` every scene
  appears complete with nothing travelling. Each scene takes block comments.
- **`doc-custom`, a sanctioned escape hatch.** Inside it the author may write
  their own HTML, a `<style>` — scoped to the block with `@scope`, by the build
  in the file and by the runtime for anything unbuilt — and a
  `<script type="forgedoc">`, run once after upgrade in its own scope with
  `block` and `reducedMotion`. The `--doc-*` tokens keep it on theme; it takes
  block comments like a figure.
- **`doc-files` › `doc-file-group` › `doc-file`, collapsible file groups.** Each
  group's header shows a title, an optional path chip, a muted count (defaults to
  the number of entries) and a +/− toggle; each entry is a path chip and an
  optional note with inline HTML. Closed groups stay findable with Ctrl+F.
- **Paths that open in the reader's editor.** With `files-root` on `doc-page`
  (absolute, or relative to the plan file), plus `files-wsl` for a WSL project,
  `doc-file` paths and the new inline `<doc-path path="…" line="…">` become
  links to VS Code, VS Code Insiders, Cursor, Windsurf, Zed or a JetBrains IDE.
  A click opens the file at once; a small picker in the corner of the files
  block (or of the page, when it has only inline paths) changes the editor for
  every path, remembered in this browser. `files-editor` sets the default,
  otherwise VS Code. For a WSL project Zed for Windows gets the
  `\\wsl.localhost` share path, since a `zed://` URL cannot ask for a WSL
  remote; "Zed inside WSL / Linux" keeps the Linux path. Without a root, paths
  stay plain chips.
- **`doc-mindmap` › `doc-node`, an interactive mind map.** A title card with
  branches of `doc-node` cards, each holding ordinary HTML — text, lists, code,
  links, an image — with an optional `icon` and a `tone` shared with the
  walkthrough. Clicking a card opens or closes its branch; `expand` sets the
  starting depth (`none`, a number of levels or `all`), and `open` / `closed`
  on a card override it. Expand all, Collapse all and Fit sit in a toolbar;
  the map pans with a drag and zooms with Ctrl+wheel or a pinch, and
  `layout="radial"` rings a small map round its title. It is a tree for
  assistive technology, with arrow keys, Home / End and Enter / Space; closed
  branches stay findable with Ctrl+F; below 640px it is an indented outline,
  and it prints fully expanded. Every card takes block comments. The validator
  rejects a `doc-node` outside a map, an `expand` it cannot read and a
  self-closed `doc-mindmap` or `doc-node`, and warns on a card both `open` and
  `closed`.
- Validator: `walkthrough/unknown-actor` and `walkthrough/duplicate-actor`
  (errors); `tag/self-closing` (an error for the new tags, a warning for the
  older ones so existing documents keep building); `custom/plain-script` and
  `custom/orphan-script` (warnings); `figure/large-mermaid`, a soft hint past 15
  statements.

### Fixed

- **Uneven top and bottom spacing inside cards.** Every commentable block
  appends its comment button after its content, so `:last-child` rules for a
  stage's or a disclosure's body never matched and their bottom inset was 0.
  Those rules now select the last child that is not the button, last-body
  padding matches the header's in every theme, and a new rule in
  `doc.utilities` drops the outer margin of the first and last block in every
  padded container.
- The `doc-roadmap` reference said `start` defaults to 1; it defaults to 0, as
  §8.5 specifies.

### Changed

- **The `better-plan` skill no longer tells the agent to write prose first.**
  It asks for whatever form clears the reader's confusion — a sentence, a
  table, a walkthrough or a custom block — with a "when this helps" menu in
  place of rules, and a new example built around a walkthrough.
- The cheatsheet folds grandchild tags into their family's row, and its
  one-page budget rose from 78 to 82 lines and from 4,800 to 5,700 characters
  for the twelve new tags and the `files-*` attributes.

## [2.1.0] - 2026-09-16

Everything here is about a reader coming back to a document rather than meeting
it for the first time. The questions are the only part of a plan a reader is
_required_ to act on, and in a document written to be read in order they are
scattered through it — so this adds a panel that gathers them, and extends the
Comment button from the blocks with no selectable text to the cards a reader
disagrees with whole. Neither costs a document a single generation token: the
panel is derived from the live DOM when it is opened, and the button is runtime
chrome.

### Added

- **A question drawer, opened from the contents panel.** Every question in the
  document in one right-hand panel, each rendered whole — the wording, every
  option with its description, the Other field and the note — so a reader can
  answer the document from one place and jump to any question in it. The
  contents trigger carries the number still unanswered, and each outline entry
  is marked with the number open in that section.

  **It costs a document nothing to have.** The panel is built from a scrape of
  the live DOM at the moment it is opened, so the agent still writes one
  `doc-choice` per question and no more (§2.4). Every control writes back
  through the element in the page rather than to the store, so `doc-choice`
  remains the only thing that knows how an answer is persisted.

  `Clear answer` sits in each card's meta row beside `Go to it`, in the danger
  ramp — it applies to one question, it only appears once that question has an
  answer, and a row of its own at the foot of every card pushed the next
  question off a panel whose whole job is to get several on screen at once.

  New parts: `questions`, `questions-icon`, `questions-count` and
  `entry-questions` on `doc-toc`; the `question-drawer*` and `question-card*`
  family on `doc-page`.

- **A Comment button on every card, not just on the blocks with no text in
  them.** `doc-note`, `doc-collapse`, `doc-stage`, `doc-step`, `doc-milestone`,
  `doc-stat`, `doc-choice`, `doc-decision` and `doc-blocker` now carry the same
  block-scoped affordance `doc-figure` and `doc-code` already had.

  why a card needs one although its text _is_ selectable: the unit a reader
  disagrees with is the whole card — a question whose options miss the real
  case, a callout whose claim is wrong — and making them rubber-band exactly
  the right sentence to say so turns one click into a drag that lands on the
  wrong boundary. Selecting text inside a card still makes an ordinary text
  comment; the two answer different questions.

  On a question this is deliberately **not** the note field. A note travels in
  the bucket as part of an answer; this is an objection to the question as
  written, which a reader who cannot answer it has nothing to attach a note to.

  The button is one speech-bubble icon in the card's top corner, and it is
  invisible until the card is hovered or focused — always visible on a touch
  device, and on a card that already carries a comment. Its host is marked
  `data-doc-feedback="corner"`, which is the documented hook for positioning it.

- **A card's Comment button reopens the comment already on it.** Pressing it
  again loads what the reader wrote into the composer, with `Save changes` and
  a `Delete` beside it, and rewrites that comment in place rather than filing a
  second one against the same card. The anchor and the timestamp are kept: this
  is the same objection said better, not a new one.

  why it matters: that button is the only handle a block comment has. A
  composer that opened blank told the reader nothing about what they had
  already said, and then quietly duplicated it.

- **`commentIcon()` and `questionIcon()`**, and `ICON_PATHS` — the icon geometry
  as plain data, so the Svelte panels draw the same shapes as the components.

### Changed

- **A question card takes most of the reading column, not the reading
  measure.** `doc-choice` is now `min(100%, max(<measure-derived>, 88%))`.

  why the measure was the wrong width: it is the floor, not the answer. A
  question is not prose — its options carry a line of explanation each — and at
  the reading measure a question with real detail in it was read through a slot
  with a third of the column empty beside it. The card still keeps a margin at
  the end, which is what makes it read as a card rather than as the page, and
  still falls back to the measure-derived width wherever the column is too
  narrow for a percentage to mean anything.

- **`doc-endpoint` restacks from its own width rather than the viewport's.**
  The narrow layout — path on one row, summary on the next — is now a
  `@container` query on the trigger instead of `@media (max-width: 720px)`.

  why it had to change: an endpoint is embedded content. Written inside a
  `doc-note`, a `doc-collapse` or a `doc-step` it gets a fraction of the reading
  column while the _window_ is still 1400px wide, so the narrow layout never
  fired and the row stayed in five columns it had no room for. The drawer keeps
  its viewport breakpoint, because the drawer is fixed to the viewport.

- **An endpoint path may wrap.** `elements.scss` gives every inline `<code>`
  `white-space: nowrap` so an identifier is never broken across a line, and
  that beat the `overflow-wrap: anywhere` the path already carried — so a long
  path simply painted across the summary beside it instead of overflowing
  visibly. Paths are now `white-space: normal`.

- **`blockContentText` no longer treats every `[data-part="header"]` as
  furniture.** In a code block or a diff the header row holds the filename and
  the language pill, which are chrome; on a card it holds the card's own title.
  Excluding it everywhere read a step back as its body with no name on it, so
  the exclusion is now scoped to `doc-code` and `doc-diff`. A question's letter
  badges, its appended Other option and its note toggle were added to the
  furniture list for the same reason — a quoted question should read as the
  question and its answers, not as `A B C ＋ Add a note`.

- **`appendFeedbackButton` takes an options object** — `{ into, icon }` —
  instead of a third positional `into` argument. Internal API; no document or
  stylesheet is affected.

## [2.0.0] - 2026-09-16

Everything in this release comes out of one question: what happens when an agent
writes a component body the way it writes a sentence, rather than the way the
examples wrap one in `<p>`? The answer was that five components shredded it down
a column, three disclosures could not close it, and a comment on more than 240
characters highlighted the first 240 of them. Fixing that meant changing the
shape of those components, which is why this is a major.

### Removed

- **`doc-step` no longer emits `[data-part="card"]`.** The card was a generated
  `<div>` that the body was moved into — which is the one thing `enhance()` may
  never do (§2.2) — and it only ever moved the _first_ child, so a step written
  as a sentence had its `<code>` chips left outside the box. The card is paint,
  not structure: the host carries the border, the background and the inset, and
  the marker is positioned into the gutter beside it.

  **If you styled `doc-step [data-part="card"]`, move those rules to
  `doc-step`.** Nothing else about the part surface changed, and the icon parts
  below are additions.

### Changed (breaking)

- **A host that holds author prose is a block, never a grid or a flex
  container.** `doc-step`, `doc-option`, `doc-milestone`, `doc-stat` and
  `doc-param` position their chrome instead of laying their children out.

  **If you overrode `grid-template-columns`, `gap` or `align-items` on any of
  those five, those rules no longer apply.** The replacement vocabulary is
  `--doc-step-disc` / `--doc-step-gap` / `--doc-step-inset` for a step, and
  `--doc-option-gutter` / `--doc-option-pad-block` / `--doc-option-pad-inline`
  for an option; both are documented where they are defined.

  why it had to change: every child of a grid container becomes a grid item,
  and each contiguous run of text _between_ two of them becomes an anonymous
  item that no selector can reach. `The <code>id</code> column` is three
  children, so a two-column grid laid it out as three rows. No amount of CSS
  fixes that from the outside; only a block host does.
- **The `default` theme's neutrals moved.** The page was `#fdfdfe` under cards
  at `#fefeff` — a ratio of 1.004, so every card was held together by its 1px
  border alone and a page of them read as one flat sheet. The page is now
  `#f6f7fb`, a card is `#ffffff`, and a card nested inside a card steps back to
  `#fafbfd`. A step's rail and numbered discs read one step above a card edge,
  since they carry meaning rather than just bounding a box. Dark mode is
  unchanged. **If you pinned `--doc-default-bg` or `--doc-default-surface`,
  check them against the new steps.**
- **An answered question is marked in neutral, not in accent.** A full-accent
  border around a card is the vocabulary a browser uses for keyboard focus, so
  a question the reader had simply finished looked like the one they were
  currently in — and on a page with several questions, several looked focused
  at once. `doc-choice:state(answered)` is a neutral edge one step up from the
  card's own hairline in all three themes that mark it, and `bun`'s 3px inset
  rail is neutral too. The accent still marks the chosen option, which is the
  part that carries the meaning.
- **A question is sized by the reading measure, not by the document column.**
  An option's label is a bare text node and its description is a `<p>` set two
  steps smaller, and `--doc-measure-prose` is in `em` — so the same token
  resolved to 672px on one and 567px on the other. The two halves of one option
  wrapped at two different right edges with a third of the card left empty
  beside the description. `doc-choice` now takes its width from the measure
  plus the chrome an option wraps around it, the description fills the option,
  and the label is weighted so it reads as the heading it is rather than
  running into the description below it.
- **The `default` theme's contents panel is 20rem, up from 15.** Section titles
  in a plan document are sentences, and at 15rem they wrapped to three lines
  each. Override `--doc-toc-width` to keep the old width.

### Fixed

- **A comment on more than 240 characters now highlights all of them.** The
  quote stored beside a comment was capped at 240 characters, and resolution
  then compared the range's text against that capped excerpt with `===`. For
  any longer selection the comparison failed against offsets that were
  perfectly correct, resolution fell through to searching for the excerpt, and
  the excerpt is what got painted — so a long comment highlighted its own first
  240 characters and stopped mid-word, in the document and in the bucket alike.
  The cap is gone: the quote is the record of what the reader commented on, and
  it is stored whole. Quotes written by 1.1.0 are still capped, so they are
  matched as a prefix and restored to their stored length.
- **The bucket's excerpt no longer runs the runtime's chrome into the prose.**
  A comment's anchor is usually a whole `doc-section`, and `textContent` on one
  of those returns the reader's paragraphs with every label the runtime drew
  mixed in — a code block's title, its language pill and its Copy and Comment
  buttons all landed mid-sentence with no space between them, so an excerpt
  could open with `electionsqlCopyCommentUPDATE`. The detail window reads the
  anchor's prose instead, and the detail heading is clamped rather than cut, so
  a long quotation ends at a line rather than mid-word.
- **A component body written as a sentence no longer shreds into a column.**
  An agent writes `<doc-step title="Devices">The <code>push_devices</code>
  migration.</doc-step>`, which is three children — text, `<code>`, text — and
  two separate bugs turned that into a stack of rows. `nameAuthorContent` was
  naming _every_ element child as the body part, so the `<code>` picked up the
  body's block typography mid-sentence; and the host was a grid or a column
  flex container, so each child became a layout item with the runs between them
  landing in anonymous items no selector could reach. `doc-step`, `doc-option`,
  `doc-milestone`, `doc-stat` and `doc-param` are now blocks that position
  their chrome instead of laying their children out, and only block children
  are named. A body written as loose prose marks its host `data-doc-flow` so a
  theme can paint it.
- **A disclosure written as a bare sentence now actually closes.**
  `doc-collapse`, `doc-stage` and `doc-tab` close by setting
  `hidden="until-found"` on their content. That is an attribute and a text node
  has none, so a panel written without a `<p>` turned its chevron and left the
  words on screen. They now build one `data-part="body"` region and put the
  author's content in it — the single documented exception to §2.2, explained
  in `core/disclosure.ts` and in PLAN §2.2. A closed body also pins
  `contain-intrinsic-size: 0`, so a panel the reader had opened once no longer
  leaves a band of empty card behind when they close it.
- **`doc-step` no longer moves author content.** It used to move its first
  child into a generated `card` element and leave the rest of the sentence
  behind — a §2.2 violation as well as the visible bug.
- **`authorChildren` was reading a `data-plan-chrome` marker** that no longer
  exists, so it counted the runtime's own chrome as author content.
- `doc-figure` names an `<svg>` as its content again; embedded tags are
  phrasing content in a sentence but _are_ the body of a figure.

### Changed

- **The runtime's icons are inline SVG, not text glyphs.** `▸`, `☰`, `←`, `→`
  and `×` are drawn by whatever font the reader has, and the geometric shapes
  have the worst coverage in Unicode — the collapse chevron rendered as a
  hairline sliver, a filled wedge or a tofu box depending on the machine, and
  sat on the text baseline rather than centred on its row. They are now one
  24-unit SVG each, stroked in `currentColor` and sized in `em`, and a control
  whose whole content is one icon now centres it with flex rather than with the
  `line-height` trick the glyphs needed. The endpoint drawer's close control
  also reads at `border-2` — it is the only way out of a modal.
- **`bun` theme: a closed disclosure is a row, not a rule.** 8px of block
  padding put a 15px label in a 37px row; it is 45px now, with the chevron
  sized to the label beside it and the body aligned under it.
- **`default` theme: the page is muted and a card is white.** It was `#fdfdfe`
  under `#fefeff` — a ratio of 1.004, so every card was held together by its
  1px border alone and a page of them read as one flat sheet. The page is now
  `#f6f7fb`, cards are `#ffffff`, and a card nested inside a card steps back to
  `#fafbfd`. A step's rail and numbered discs read one step above a card edge,
  since they carry meaning rather than just bounding a box.
- **`default` theme: the contents panel is 20rem, up from 15.** Section titles
  in a plan document are sentences, and at 15rem they wrapped to three lines
  each.

## [1.1.0] - 2026-09-14

### Added

- **Three new themes.** `default`, `geist` and `bun` join the original
  `forgedoc` look. Pick one per build with `forgedoc build --theme <name>`, or
  let the document name its own with `<style>/*@DOC_CSS:geist@*/</style>`.
  `forgedoc themes` lists what an installation can build with.
- **Themes can vendor their own typefaces.** A theme that ships `fonts/*.woff2`
  has them embedded into its compiled stylesheet, so an `--offline` document
  keeps its fonts on a machine that has never seen them. `default` vendors Plus
  Jakarta Sans and JetBrains Mono; `geist` vendors Geist Sans and Geist Mono.
  Both are SIL Open Font License, included beside the files.
- **The selection comment composer can be turned off.** It pops open on every
  text selection, which is right for a first-time reader and in the way for
  someone reading closely or quoting elsewhere. ⌘/Ctrl+K toggles it, the
  preference persists per document, and the block `Comment` buttons and the
  feedback panel keep working when it is off.
- **A second agent skill, `better-docs`,** for reader-facing documentation —
  guides, tutorials, references, runbooks, ADRs, onboarding. `better-plan`
  stays the skill for planning documents that ask the reader to decide.
- `doc-code` now carries the language as `data-lang` on its label, so a theme
  can draw language-aware chrome. The visible label is unchanged.

### Changed

- **`forgedoc build` now compiles the `default` theme instead of `forgedoc`.**
  Documents rebuilt without an explicit `--theme` will look different. Pass
  `--theme forgedoc` to keep the previous appearance. Already-built documents
  are static files and are unaffected.
- `dist/forgedoc.css` is the `default` theme and is therefore larger than
  before, because it carries two embedded typefaces. Themes that vendor no
  fonts stay small; `dist/themes/forgedoc.css` is unchanged in size.
- `forgedoc` is now the _reference_ theme rather than the default one: it is
  what `check-style-layers` reads the required token set from, and what a new
  theme should be copied from.

### Fixed

- `doc-figure type="html"` no longer copies an authored `doc-caption`, or any
  runtime-added chrome, into its isolated frame.
- A state blob written before the selection-composer preference existed now
  reads as "composer on" rather than "off". Reopening an older document with the
  composer silently disabled looked exactly like the bug the preference fixes.

### Removed

- **Appearance is no longer tested.** Screenshot comparison, computed-style
  assertions and layout geometry are gone from the suite, along with the
  `test:visual:ci` and `test:visual:update` scripts and the `@pixel` tag.
  Styling changes often and by intent, so a test that fails when a colour, a
  margin or a breakpoint moves reports a decision as a defect. Themes are
  checked by looking at them — `npm run preview`. The browser suite that
  remains asserts behaviour only.

## [1.0.0] - 2026-07-30

Initial release.
