---
title: Quick Start
description: Build your first document, collect an answer and a comment, and send the feedback back to your AI.
---

This walkthrough takes you from a working CLI to an answerable HTML document.
Complete [Installation](/docs/installation/) first. You need a text editor and a
modern browser; a document does not require a framework or application server.

## 1. Scaffold a document

The walkthrough uses the global CLI. If you chose one-off or project-local
execution, use that runner in front of each `forgedoc` command instead.

```sh
forgedoc version
forgedoc new vendor-orders
```

The scaffold is named `DOC_vendor-orders.html`. The version command confirms which installation you will use to build it.

For an occasional document, use `npx forgedoc` instead of installing globally. Keep a consistent package version when reproducible output matters.

## 2. Write the meaning and build

Replace the scaffold with this complete document:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vendor inbox proposal</title>
  <style>/*@DOC_CSS@*/</style>
</head>
<body>
  <doc-page doc-id="vendor-orders" accent="teal">
    <doc-header kicker="Proposal · Vendor experience">
      A shared vendor inbox
      <p slot="lede">Make new orders visible to the whole team.</p>
    </doc-header>

    <doc-section title="The approach">
      <p>Show all incoming orders in one inbox. Every order has a clear owner.</p>
      <doc-note kind="info" title="Keep the first release small">
        <p>Ship the shared inbox before adding assignment rules.</p>
      </doc-note>
    </doc-section>

    <doc-section title="One decision before implementation">
      <doc-choice mode="single" question="Should read state be shared?">
        <doc-option recommended>Shared team inbox</doc-option>
        <doc-option>Per-person read state</doc-option>
      </doc-choice>
    </doc-section>
  </doc-page>
  <script>//@DOC_JS@</script>
</body>
</html>
```

```sh
forgedoc build DOC_vendor-orders.html
```

Build validates first. If the markup fails, it prints diagnostics and writes no output. On success, it rewrites `DOC_vendor-orders.html` in place.

## 3. Open, answer, and copy

Open the HTML file in your browser. The ordinary build loads its runtime from a version-pinned CDN, so you need network access on the first open.

Choose an option. Select a sentence and add a comment. Open the feedback bucket and use **Copy**. Paste the resulting `=== FB v1 ·` block back into the author's conversation.

Refresh the document to check that the answer persists in this browser. Persistence uses local storage and is scoped by the stable `doc-id`. It is not a shared server inbox.

## Send a self-contained copy

```sh
forgedoc build DOC_vendor-orders.html --offline
```

Offline mode embeds the runtime and Mermaid. It writes a delivery artifact into `.temp/` by default. Send that artifact to the reader; keep the ordinary document as your small, revisable source.

## If a step fails

| Symptom | Next action |
| --- | --- |
| `forgedoc` is not found | Check that your npm global binary directory is on `PATH`, or use `npx forgedoc`. |
| Build reports an unknown tag or attribute | Run `forgedoc info <element>` and correct the reported location. |
| The file shows plain, unenhanced HTML | Check network access for a CDN build, or rebuild with `--offline`. |
| An answer does not survive refresh | Check the storage warning and copy feedback before closing the page. |

## What you built

You now have a proposal with a real decision, persistent answers, and feedback that can travel back to an agent. Learn [how to revise it](/docs/feedback/), [write documentation instead of a proposal](/docs/guides/documentation/), or look up the [full tag vocabulary](/docs/reference/cheatsheet/).
