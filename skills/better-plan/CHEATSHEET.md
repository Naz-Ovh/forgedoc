# ForgeDoc cheatsheet

Write **semantic markup only**. No `<style>`, `<script>`, classes, ids, or section numbers. Only use elements when necessary. File prefix: `PLAN_<name>.html` for plans, `DOC_<name>.html` for docs.

```html
<style>/*@DOC_CSS@*/</style>   <!-- in <head> -->
<doc-page doc-id="demo" density="comfortable" accent="teal">
  <doc-header kicker="Plan · Demo">Title<p slot="lede">Lede.</p></doc-header>
  <doc-section title="Overview"><p>Prose.</p></doc-section>
</doc-page>
<script>//@DOC_JS@</script>    <!-- last line of <body> -->
```

Build: `forgedoc build <file.html>` (`--offline` embeds runtime). Validate: `forgedoc validate <file.html> --format=json`.

## Shell & Meta

| Tag | Attributes & Notes |
| --- | --- |
| `doc-page` | **`doc-id`** · `density` compact/comfortable/spacious · `scale` sm/md/lg · `accent` teal/indigo/slate/plum/amber · `measure` narrow/default/wide · `code` auto/light/dark · `toc` open/closed/docked/off · `numbering` counter/text |
| `doc-header` | `kicker` — title is child text, optional `<p slot="lede">` |
| `doc-section` | **`title`** — nests to depth 3; number, id and TOC entry are derived |
| `doc-chips` › `doc-chip` | `kind` confirmed/info/action/pending |
| `doc-owners` › `doc-owner` | **`name`** · `role` · `status` approved/reviewing/pending · `avatar` |

## Prose, callouts & specs

| Tag | Attributes & Notes |
| --- | --- |
| `doc-note` | `kind` info/tip/warn/danger/success · `title` |
| `doc-badge` | `variant` info/success/warn/danger/neutral/accent — inline |
| `doc-blocker` | **`title`** · `severity` low/medium/high — needs `doc-blocks` + `doc-action`, optional `doc-why` |
| `doc-list` | `marker` check/cross/arrow/dot/number · `title` · `kind` positive/negative/neutral — children are `<li>` |
| `doc-compare` | `columns` (2) — children are `doc-list` blocks with a `title` |
| `doc-table` · `doc-quote` | table takes `size` sm/md · `stack` auto/never. quote takes `cite` |
| `doc-term` · `doc-ref` | inline: `doc-term` takes **`href`**, `doc-ref` takes **`to`** |
| `doc-decision` | **`title`** · `id` · `status` proposed/accepted/rejected/superseded/deprecated · `date` |
| `doc-endpoint` | **`path`** · **`method`** get/post/put/patch/delete/head/options · `summary` · `description` · `auth` · `headers` · `params` (`name:in:type:required|optional:description`) · `request` · `status` · `response` — opens the shared API drawer |
| `doc-params` › `doc-param` | **`name`** · `type` · `in` path/query/header/body · `required` · `default` |
| `doc-steps` › `doc-step` | **`title`** · `status` completed/active/pending/optional · `open` |

## Metrics, planning & interactive

| Tag | Attributes & Notes |
| --- | --- |
| `doc-stats` › `doc-stat` | **`label`** · **`value`** · `diff` · `trend` up/down/neutral · `good` · `tone` good/bad/neutral |
| `doc-timeline` › `doc-milestone` | **`date`** · **`title`** · `status` completed/in-progress/planned/delayed · `owner` |
| `doc-matrix` | `type` raci/risk/comparison — wraps standard `<table>` |
| `doc-choice` › `doc-option` | **`question`** · `mode` single/multi — option takes `recommended`, `value`, optional `<p slot="desc">` |
| `doc-rating` | **`question`** · `scale` (5) · `mode` numeric/stars — scorecard saved to bucket |
| `doc-collapse` | **`title`** · `open` · `sticky` |
| `doc-tabs` › `doc-tab` | tab takes **`label`** · `active` |
| `doc-checklist` · `doc-carousel` | checklist children are `<li>`. carousel takes `title` · `autoplay` |

## Structure & content

| Tag | Attributes & Notes |
| --- | --- |
| `doc-roadmap` › `doc-stage` | roadmap takes `start` (0) · stage takes **`title`**, `subtitle`, `current`, `open` |
| `doc-flow` › `doc-flow-node` | node takes **`title`**, `active`; child text is subtitle |
| `doc-code` · `doc-diff` | code takes **`lang`** · `title` · `wrap` · `highlight`. diff takes `lang` · `filename` |
| `doc-figure` · `doc-caption` · `doc-tree` | figure takes `type` svg/image/mermaid/html · `src` · `alt` · `caption` (or `doc-caption`). tree takes `root` |

`lang` allowlist: `ts js tsx jsx html css json bash sh sql rust python yaml toml diff http text`. Use plain HTML for `<p> <ul> <ol> <li> <code> <a> <strong> <em> <table> <h1>–<h6>`. Never write `doc-toc`, `role=`, `aria-*`, `class=`, `id=`, or numbers.

## Overriding order: 1. Preset attribute (`<doc-page density="compact">`) · 2. **Token** (`--doc-accent-600`) · 3. **Raw CSS** (`[data-part="title"]`).
