# ForgeDoc cheatsheet

Write **semantic markup only**. A prebuilt runtime supplies styling, layout, interactivity, persistence and feedback collection. Use an element only where the document needs it. Name the file `PLAN_<name>.html` for a plan, `DOC_<name>.html` for a document.

```html
<style>/*@DOC_CSS@*/</style>   <!-- in <head> -->
<doc-page doc-id="demo" density="comfortable" accent="teal">
  <doc-header kicker="Plan · Demo">Title<p slot="lede">Lede.</p></doc-header>
  <doc-section title="Overview"><p>Prose.</p></doc-section>
</doc-page>
<script>//@DOC_JS@</script>    <!-- last line of <body> -->
```

Build in place `forgedoc build <file.html>` — one file, rebuilt on every revision · offline `--offline` · keep versions `--history` · check `forgedoc validate <file.html> --format=json` · detail `forgedoc info <element>` · find one `forgedoc search <words>`.

## Shell & meta

| Tag | Attributes |
| --- | --- |
| `doc-page` | **`doc-id`** slug · `density` compact/comfortable/spacious · `scale` sm/md/lg · `accent` teal/indigo/slate/plum/amber · `measure` narrow/default/wide · `code` auto/light/dark · `toc` open/closed/docked/off · `numbering` counter/text |
| `doc-header` | `kicker` |
| `doc-section` | **`title`** |
| `doc-toc` | generated — never write it |
| `doc-chips` › `doc-chip` | chip: `kind` confirmed/info/action/pending |
| `doc-owners` › `doc-owner` | owner: **`name`** · `role` · `avatar` · `status` approved/pending/reviewing/rejected |

## Prose, callouts & specs

| Tag | Attributes |
| --- | --- |
| `doc-decision` | **`title`** · `id` · `status` accepted/proposed/rejected/deprecated/superseded · `date` |
| `doc-endpoint` | **`method`** get/post/put/patch/delete/options/head · **`path`** · `summary` · `description` · `auth` bearer/basic/api-key/session/none · `headers` · `params` · `request` · `status` · `response` |
| `doc-params` › `doc-param` | param: **`name`** · `type` · `in` path/query/header/body · `required` · `default` |
| `doc-steps` › `doc-step` | step: **`title`** · `status` completed/active/pending/optional |
| `doc-badge` | `variant` info/success/warn/danger/neutral/accent |
| `doc-note` | `kind` info/tip/warn/danger/success · `title` |
| `doc-blocker` › `doc-blocks` + `doc-why` + `doc-action` | **`title`** · `severity` high/medium/low |
| `doc-list` | `marker` check/cross/arrow/dot/number · `title` · `kind` positive/negative/neutral |
| `doc-quote` | `cite` |
| `doc-term` | **`href`** url |
| `doc-ref` | **`to`** |

## Metrics, planning & interactive

| Tag | Attributes |
| --- | --- |
| `doc-stats` › `doc-stat` | stat: **`label`** · **`value`** · `trend` up/down/flat · `good` · `tone` good/bad/neutral · `diff` |
| `doc-timeline` › `doc-milestone` | milestone: **`date`** · **`title`** · `status` completed/in-progress/planned/delayed · `owner` |
| `doc-matrix` | `type` raci/risk/comparison/custom |
| `doc-choice` › `doc-option` | **`question`** · `id` slug · `mode` single/multi — option: `label` · `value` · `hint` · `recommended` · `other` |
| `doc-rating` | **`question`** · `id` slug · `scale` integer |
| `doc-checklist` | no attributes |
| `doc-tabs` › `doc-tab` | tab: **`label`** · `active` |
| `doc-collapse` | **`title`** · `open` · `sticky` |
| `doc-carousel` | `title` |

## Structure & content

| Tag | Attributes |
| --- | --- |
| `doc-flow` › `doc-flow-node` | flow-node: **`title`** · `active` |
| `doc-walkthrough` › `doc-actor` + `doc-scene` › `doc-move` + `doc-change` | `title` — actor: **`name`** slug · `label` · `kind` person/app/service/table/store · `tone` accent/blue/green/amber/red/violet/cyan/rose/neutral · `absent` — scene: **`title`** · `focus` — move: **`from`** slug · **`to`** slug · `token` · `result` accept/reject — change: **`actor`** slug · `add` · `remove` · `set` · `tone` good/bad/neutral · `drop` |
| `doc-roadmap` › `doc-stage` | `start` integer — stage: **`title`** · `subtitle` · `current` · `open` |
| `doc-code` | **`lang`** see allowlist · `title` · `highlight` · `wrap` |
| `doc-diff` | `lang` see allowlist · `filename` |
| `doc-figure` › `doc-caption` | `type` svg/image/mermaid/html · `caption` · `src` url · `alt` |
| `doc-table` | `size` sm/md · `stack` auto/never |
| `doc-tree` | `root` |
| `doc-compare` | `columns` 2/3/4 |
| `doc-custom` | `title` |

## Rules

- Never write `<style>`, `<script>`, `class=`, `role=` or `aria-*` outside `doc-custom` — the runtime owns them.
- Never write section numbers (`1.2.1`), stage numbers, or option letters (`A`/`B`/`C`) — every one is derived, and a typed one goes stale.
- Never write `id=` — ids come from `title` and `question`. Override only for an anchor that must survive a reworded heading.
- Never write `doc-toc` — generated from your sections. Steer it with `<doc-page toc="docked">`.
- Already styled, so there is no tag for them: `<p>` `<ul>` `<ol>` `<li>` `<code>` `<a>` `<strong>` `<em>` `<table>` `<h1>` `<h2>` `<h3>` `<h4>` `<h5>` `<h6>`. `lang` allowlist: ts js tsx jsx html css json bash sh sql rust python yaml toml diff http text.
- Override in this order: preset attribute (`<doc-page density="compact">`), then **token** (`--doc-accent-600`), then **raw CSS** (`[data-part="title"]`, no `!important` needed).
