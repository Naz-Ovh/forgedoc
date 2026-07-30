# PlanKit cheatsheet

Write **only** semantic markup. No `<style>`, no `<script>`, no classes, no ids, no `A`/`B` keys, no section numbers — the runtime derives all of it.

```html
<style>/*@PLAN_CSS@*/</style>   <!-- in <head> -->
<plan-doc plan-id="vendor-orders" density="comfortable" accent="teal">
  <plan-header kicker="Plan · Vendor dashboard">Vendor orders experience
    <p slot="lede">One sentence on what this is.</p></plan-header>
  <plan-section title="What we are building"><p>Prose.</p></plan-section>
</plan-doc>
<script>//@PLAN_JS@</script>    <!-- last line of <body> -->
```

Then: `plankit build PLAN_x.html` → one ~15 kB file linking a pinned CDN. Add `--offline` to embed the runtime instead, for a `file://` document with no network. `plankit validate x.html --format=json` for a machine-readable report.

## Shell

| Tag            | Attributes                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plan-doc`     | **`plan-id`** · `density` compact/comfortable/spacious · `scale` sm/md/lg · `accent` teal/indigo/slate/plum/amber · `measure` narrow/default/wide · `code` auto/light/dark · `toc` open/closed/docked/off · `numbering` counter/text |
| `plan-header`  | `kicker` — title is the text, plus optional `<p slot="lede">`                                                                                                                                                                        |
| `plan-section` | **`title`** — nests to depth 3; number, id and TOC entry are derived                                                                                                                                                                 |

## Prose and callouts

| Tag                        | Attributes                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `plan-chips` › `plan-chip` | `kind` confirmed/info/action/pending                                                                     |
| `plan-note`                | `kind` info/tip/warn/danger/success · `title`                                                            |
| `plan-blocker`             | **`title`** · `severity` low/medium/high — needs `plan-blocks` + `plan-action`, optional `plan-why`      |
| `plan-list`                | `marker` check/cross/arrow/dot/number · `title` · `kind` positive/negative/neutral — children are `<li>` |
| `plan-compare`             | `columns` (2) — children are `plan-list` blocks with a `title`                                           |
| `plan-table`               | `size` sm/md · `stack` auto/never — wraps a plain `<table>`                                              |
| `plan-quote`               | `cite`                                                                                                   |
| `plan-term`                | **`href`** — inline, for a technical term                                                                |
| `plan-ref`                 | **`to`** — inline; renders the live number of a section/stage/question                                   |

## Interactive

| Tag                           | Attributes                                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan-choice` › `plan-option` | **`question`** · `mode` single/multi — option takes `recommended`, `value`; optional `<p slot="desc">`. Letters, the Other box and the note field are derived. Needs ≥2 options. |
| `plan-collapse`               | **`title`** · `open` · `sticky`                                                                                                                                                  |
| `plan-tabs` › `plan-tab`      | tab takes **`label`** · `active`                                                                                                                                                 |
| `plan-checklist`              | children are `<li>`; ticks persist                                                                                                                                               |

## Structure and content

| Tag                            | Attributes                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `plan-roadmap` › `plan-stage`  | roadmap takes `start` (0) · stage takes **`title`**, `subtitle`, `current`, `open`   |
| `plan-flow` › `plan-flow-node` | node takes **`title`**, `active`; child text is the subtitle                         |
| `plan-code`                    | **`lang`** · `title` · `wrap` · `highlight` (`3-5,9`)                                |
| `plan-diff`                    | `lang` · `filename` — content is a unified diff                                      |
| `plan-figure`                  | `type` svg/image/mermaid/html · `src` · `alt` · `caption`, or a `plan-caption` child |
| `plan-tree`                    | `root` — content is indented plain text                                              |

`lang` allowlist: `ts js tsx jsx html css json bash sh sql rust python yaml toml diff http text`. Anything else fails the build.

## Use plain HTML for

`<p> <ul> <ol> <li> <code> <a> <strong> <em> <table> <h1>–<h6>` — all styled globally. Never write `plan-toc`, `role=`, `aria-*`, `class=`, `id=`, `disabled`, or a section number.

## Overriding, in order of preference

1. **Preset attribute** — `<plan-doc density="compact">`. Validated.
2. **Token** — `plan-note { --plan-accent-600: #8b5cf6 }`. Survives upgrades.
3. **Raw CSS** — `plan-note [data-part="title"] { letter-spacing: .02em }`. Wins automatically; no `!important` needed. Only `data-part` selectors are public API.

Recommended bundles: _presentation_ = `density="spacious" scale="lg" measure="narrow"` · _dense review_ = `density="compact" scale="sm" measure="wide"`.
