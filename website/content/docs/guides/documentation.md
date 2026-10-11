---
title: Technical documentation
description: Build useful tutorials, how-to guides, runbooks, and API references with semantic HTML.
---

ForgeDoc is useful for documentation that people read, follow, and improve. Start with a reader's task, then choose the smallest vocabulary that makes it clear. A guide does not need a planning phase or an open question to be a ForgeDoc document.

## Choose the shape before the tags

| Document | Reader's need | Useful structure |
| --- | --- | --- |
| Tutorial | Learn by building something | Prerequisites, ordered steps, a visible result |
| How-to | Complete a specific task | Commands, expected outcome, verification |
| Reference | Look up an exact contract | Parameters, allowed values, examples |
| Explanation | Understand a design | Problem, approach, trade-offs |
| Runbook | Respond reliably under pressure | Checks, actions, recovery, escalation |

A page can link to another shape instead of trying to satisfy every need at once. Keep a tutorial focused on reaching a result; put the full option catalog in a reference.

## Build a task-focused guide

Create a file with the [document shell](/docs/authoring/) and use steps for actions the reader can perform.

```html
<doc-section title="Create a local build">
  <p>You need Node.js 20 or newer and a checkout of the project.</p>
  <doc-steps>
    <doc-step title="Install dependencies">
      <doc-code lang="bash">pnpm install --frozen-lockfile</doc-code>
    </doc-step>
    <doc-step title="Build the library">
      <doc-code lang="bash">npm run build</doc-code>
      <p>The compiled runtime and CLI are written into dist/.</p>
    </doc-step>
    <doc-step title="Verify the change">
      <doc-code lang="bash">npm run check</doc-code>
      <p>All formatting, lint, type, build, and test checks must pass.</p>
    </doc-step>
  </doc-steps>
</doc-section>
```

Give each step an observable result. “Configure the service” is too vague; name the file, show the change, and tell the reader what confirms it worked.

## Add reference content where precision matters

Use `doc-code` for complete requests and responses. Use `doc-table` for compact comparisons. Consult [doc-endpoint](/docs/reference/doc-endpoint/), [doc-params](/docs/reference/doc-params/), and [doc-param](/docs/reference/doc-param/) before writing API markup; their validated attribute names are part of the contract.

For a library guide, distinguish package exports from internal helpers. A function appearing in `src/` does not automatically make it importable from `forgedoc`. The [runtime API](/docs/runtime-api/) documents the actual package entry point.

## Make a runbook verifiable

```html
<doc-section title="Before handing the document over">
  <doc-checklist>
    <li>The document has a unique, stable doc-id.</li>
    <li>Validation reports no errors.</li>
    <li>The reader can open the intended delivery artifact.</li>
    <li>Feedback can be copied back to the author.</li>
  </doc-checklist>
</doc-section>
```

Checklist state persists locally. It confirms what this reader has checked; it does not become an organization-wide sign-off record.

## Ask only for real decisions

Documentation can be entirely explanatory. Add `doc-choice` when an answer changes the work: for example, choosing an installation method or recording a review decision. Use ordinary prose when the answer is already settled.

If the reader raises a correction, revise the original paragraph. If they point out an unresolved trade-off, add a question that represents the actual options.

## Verify and deliver

```sh
forgedoc validate DOC_local-build.html --format=json
forgedoc build DOC_local-build.html
```

Open the resulting file, read every command in order, and perform the documented task. Use [offline delivery](/docs/guides/delivery/) when the environment has no network. If validation fails, use the diagnostic's suggested fix and the [component reference](/docs/reference/) rather than guessing an attribute.
