---
title: Agent guide
description: A precise contract for using ForgeDoc directly, whether you are writing a plan, documenting code, or revising feedback.
---

Use ForgeDoc when the requested deliverable is a readable HTML document with useful structure or reader interaction. Write the semantic source and invoke the CLI. A separate planning exercise is not required to write a guide, reference, or runbook.

If the user's task is to change application code, carry out that task. Do not replace implementation with a ForgeDoc plan unless the user requested a plan. ForgeDoc is a document format and runtime, not a mandatory gate for coding work.

## Identity and entry points

| Thing | Name |
| --- | --- |
| npm package | `forgedoc` |
| CLI | `forgedoc` |
| IIFE global | `ForgeDoc` |
| Planning skill | `better-plan` |
| Documentation skill | `better-docs` |

```sh
npm install -g forgedoc
npx skills add naz-ovh/forgedoc
```

The skills carry authoring instructions into supported agent environments. They use the CLI to build documents, so the binary must be available. You can also use the markup and CLI directly from these docs.

## The authoring contract

1. Write a complete HTML file with one `doc-page` and a unique, stable `doc-id`.
2. Put `<style>/*@DOC_CSS@*/</style>` in the head.
3. Put `<script>//@DOC_JS@</script>` at the end of the body.
4. Write `doc-*` elements and ordinary prose HTML. Do not emit the runtime.
5. Let ForgeDoc derive option keys, section numbers, IDs, accessibility chrome, and controls.
6. Look up unfamiliar tags and attributes with `forgedoc info`, `search`, or `cheatsheet`.
7. Build, read diagnostics, fix the exact source, and rebuild until validation passes.
8. Revise the same file when feedback arrives. Preserve `doc-id`.

Custom styling and explicit IDs are escape hatches, not the default authoring strategy. Theme choices belong in the CSS placeholder or build flag.

## A complete starter

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Local development guide</title>
  <style>/*@DOC_CSS@*/</style>
</head>
<body>
  <doc-page doc-id="local-development">
    <doc-header kicker="Guide · Engineering">
      Local development
      <p slot="lede">Build the project and verify a change.</p>
    </doc-header>
    <doc-section title="Build">
      <doc-code lang="bash">npm run build</doc-code>
      <p>Verify the output before handing it to a reader.</p>
    </doc-section>
  </doc-page>
  <script>//@DOC_JS@</script>
</body>
</html>
```

Save as `DOC_local-development.html`, then run:

```sh
forgedoc build DOC_local-development.html
```

The normal build validates and rewrites the input with pinned CDN resources. `--offline` produces an embedded delivery artifact under `.temp/` by default. Do not mistake those two outputs.

## Document facts from the code

Read the implementation, exported types, tests, and package export map before describing an API. Commands and signatures in a guide must match what a reader can actually call.

The current browser entry point exports `defineAll`, `version`, `vocabulary`, `chips`, and `store`. It does not export `parseBucket` or `TAGS`. Internal paths are useful for contributing to ForgeDoc, but they are not automatically package APIs.

## Read feedback without guessing

A feedback block starts with `=== FB v1 ·`. Match each item by anchor and quoted text. Match answers only to the original question wording. Treat labels as authoritative and Other text as a new proposal. Process valid items even if one item is malformed.

Replace settled choices with statements, remove the answered question, and rebuild the same file. See the [feedback workflow](/docs/feedback/) and [FB v1 format contract](/docs/feedback-format/).

## Retrieve only what you need

- [/llms.txt](/llms.txt): index of all Markdown pages.
- [/llms-full.txt](/llms-full.txt): the complete handbook.
- [/llm.txt](/llm.txt) and [/llm-full.txt](/llm-full.txt): aliases of the same automatic exports.
- [/markdown/agents.md](/markdown/agents.md): this contract.
- [/markdown/reference/cheatsheet.md](/markdown/reference/cheatsheet.md): vocabulary overview.
- [Component reference](/docs/reference/): exact attribute and nesting constraints.

Use the index for targeted retrieval instead of automatically loading the full reference into every task. These resources improve access during inference; they do not promise future training inclusion.
