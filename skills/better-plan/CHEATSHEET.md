# ForgeDoc cheatsheet

Write **only** semantic markup. No `<style>`, no `<script>`, no classes, no ids, no `A`/`B` keys, no section numbers — the runtime derives all of it.

```html
<style>/*@DOC_CSS@*/</style>   <!-- in <head> -->
<doc-page doc-id="vendor-orders" density="comfortable" accent="teal">
  <doc-header kicker="Plan · Vendor dashboard">Vendor orders experience
    <p slot="lede">One sentence on what this is.</p></doc-header>
  <doc-section title="What we are building"><p>Prose.</p></doc-section>
</doc-page>
<script>//@DOC_JS@</script>    <!-- last line of <body> -->
```

Then: `forgedoc build DOC_x.html` → one ~15 kB file linking a pinned CDN. Add `--offline` to embed the runtime instead, for a `file://` document with no network. `forgedoc validate x.html --format=json` for a machine-readable report.

## Shell

| Tag           | Attributes                                                                                                                                                                                                                          |
|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `doc-page`    | **`doc-id`** · `density` compact/comfortable/spacious · `scale` sm/md/lg · `accent` teal/indigo/slate/plum/amber · `measure` narrow/default/wide · `code` auto/light/dark · `toc` open/closed/docked/off · `numbering` counter/text |
| `doc-header`  | `kicker` — title is the text, plus optional `<p slot="lede">`                                                                                                                                                                       |
| `doc-section` | **`title`** — nests to depth 3; number, id and TOC entry are derived                                                                                                                                                                |

## Prose and callouts

| Tag                      | Attributes                                                                                               |
|--------------------------|----------------------------------------------------------------------------------------------------------|
| `doc-chips` › `doc-chip` | `kind` confirmed/info/action/pending                                                                     |
| `doc-note`               | `kind` info/tip/warn/danger/success · `title`                                                            |
| `doc-blocker`            | **`title`** · `severity` low/medium/high — needs `doc-blocks` + `doc-action`, optional `doc-why`         |
| `doc-list`               | `marker` check/cross/arrow/dot/number · `title` · `kind` positive/negative/neutral — children are `<li>` |
| `doc-compare`            | `columns` (2) — children are `doc-list` blocks with a `title`                                            |
| `doc-table`              | `size` sm/md · `stack` auto/never — wraps a plain `<table>`                                              |
| `doc-quote`              | `cite`                                                                                                   |
| `doc-term`               | **`href`** — inline, for a technical term                                                                |
| `doc-ref`                | **`to`** — inline; renders the live number of a section/stage/question                                   |

## Interactive

| Tag                         | Attributes                                                                                                                                                                       |
|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `doc-choice` › `doc-option` | **`question`** · `mode` single/multi — option takes `recommended`, `value`; optional `<p slot="desc">`. Letters, the Other box and the note field are derived. Needs ≥2 options. |
| `doc-collapse`              | **`title`** · `open` · `sticky`                                                                                                                                                  |
| `doc-tabs` › `doc-tab`      | tab takes **`label`** · `active`                                                                                                                                                 |
| `doc-checklist`             | children are `<li>`; ticks persist                                                                                                                                               |

## Structure and content

| Tag                          | Attributes                                                                          |
|------------------------------|-------------------------------------------------------------------------------------|
| `doc-roadmap` › `doc-stage`  | roadmap takes `start` (0) · stage takes **`title`**, `subtitle`, `current`, `open`  |
| `doc-flow` › `doc-flow-node` | node takes **`title`**, `active`; child text is the subtitle                        |
| `doc-code`                   | **`lang`** · `title` · `wrap` · `highlight` (`3-5,9`)                               |
| `doc-diff`                   | `lang` · `filename` — content is a unified diff                                     |
| `doc-figure`                 | `type` svg/image/mermaid/html · `src` · `alt` · `caption`, or a `doc-caption` child |
| `doc-tree`                   | `root` — content is indented plain text                                             |

`lang` allowlist: `ts js tsx jsx html css json bash sh sql rust python yaml toml diff http text`. Anything else fails the build.

## Use plain HTML for

`<p> <ul> <ol> <li> <code> <a> <strong> <em> <table> <h1>–<h6>` — all styled globally. Never write `doc-toc`, `role=`, `aria-*`, `class=`, `id=`, `disabled`, or a section number.

## Overriding, in order of preference

1. **Preset attribute** — `<doc-page density="compact">`. Validated.
2. **Token** — `doc-note { --doc-accent-600: #8b5cf6 }`. Survives upgrades.
3. **Raw CSS** — `doc-note [data-part="title"] { letter-spacing: .02em }`. Wins automatically; no `!important` needed. Only `data-part` selectors are public API.

Recommended bundles: _presentation_ = `density="spacious" scale="lg" measure="narrow"` · _dense review_ = `density="compact" scale="sm" measure="wide"`.
