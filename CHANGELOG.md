# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
