---
title: Authoring
description: Write content and intent. Let the runtime derive navigation, presentation, and reader controls.
---

A ForgeDoc source file is ordinary HTML with `doc-*` elements. These tags describe what a piece of content means: a section, a question, a code listing, a warning, a roadmap stage. They do not describe how to draw it.

## The shell

Every authored document has one `doc-page`, a stable `doc-id`, and two runtime placeholders.

```html
<head>
  <style>/*@DOC_CSS@*/</style>
</head>
<body>
  <doc-page doc-id="account-onboarding">
    <doc-header kicker="Guide · Accounts">
      Account onboarding
      <p slot="lede">Everything a new teammate needs to get started.</p>
    </doc-header>
    <doc-section title="Before you begin">
      <p>Ask your team administrator for an invitation.</p>
    </doc-section>
  </doc-page>
  <script>//@DOC_JS@</script>
</body>
```

Put CSS in the head so it arrives before the markup. Put the script at the end of the body so elements upgrade with all their children present. With a direct CDN script, use `defer` instead.

## Identity follows the document

Choose a lowercase slug such as `account-onboarding`. Keep it when revising the document; change it for a genuinely different document. The store is namespaced as `forgedoc:<doc-id>:state`.

The runtime derives section and question anchors from their content. Prefer those derived anchors. An explicit `id` is a supported override when you need a stable integration target, but it adds identity that you must maintain yourself.

## Structure follows meaning

Use nested `doc-section` elements for the document hierarchy. Do not write section numbers into titles. Use ordinary `<p>`, `<strong>`, `<em>`, and links for prose. Introduce a custom element when it expresses a useful relationship or interaction.

| Content | Element |
| --- | --- |
| A section of the argument | `doc-section` |
| A note the reader should notice | `doc-note` |
| A decision the reader must answer | `doc-choice` with `doc-option` children |
| Sequential instructions | `doc-steps` with `doc-step` children |
| A persisted checklist | `doc-checklist` containing list items |
| Code with highlighting | `doc-code` |
| A diagram or image | `doc-figure` |
| An API endpoint | `doc-endpoint` with `doc-params` and `doc-param` |

The [cheatsheet](/docs/reference/cheatsheet/) covers the rest. The [component reference](/docs/reference/) lists the exact values, required children, and nesting rules.

## Keep runtime details out of the source

Do not hand-author option letters, generated controls, navigation, feedback UI, numbering, accessibility chrome, or runtime class names. Components assign their semantics and controls when they upgrade.

Custom CSS and explicit IDs are supported escape hatches. Use [presets and tokens](/docs/themes/) first. The validator warns about some escape hatches rather than rejecting every customized document.

## Code and diagrams are text inputs

```html
<doc-code lang="ts" title="orders.ts">
export function orderLabel(id: string): string {
  return `Order ${id}`;
}
</doc-code>
```

`doc-code` reads raw text. HTML parsing still applies, so escape `<` and `&` when the sample contains them. Avoid reformatting verbatim blocks with an HTML formatter. Supported language names are an [explicit allowlist](/docs/reference/#code-language-allowlist).

For Mermaid, put diagram source inside the figure. Use `->>` for sequence arrows when possible; avoid raw `<` characters that the HTML parser could interpret as tags.

```html
<doc-figure type="mermaid" caption="How an order reaches the inbox">
sequenceDiagram
  participant API
  participant Inbox
  API->>Inbox: New order
</doc-figure>
```

## Validate as you write

```sh
forgedoc validate DOC_account-onboarding.html --format=json
forgedoc build DOC_account-onboarding.html
```

A diagnostic includes the file, line, column, rule ID, severity, message, and a suggested fix. Correct the source and rebuild. Avoid bypassing validation as a normal authoring strategy.

Continue with [documentation recipes](/docs/guides/documentation/) or [planning recipes](/docs/guides/planning/).
