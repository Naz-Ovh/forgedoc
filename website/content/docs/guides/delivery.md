---
title: Build and delivery
description: Choose CDN, offline, history, or explicit output according to where the reader will open the document.
---

The usual build rewrites one small HTML file. Choose another mode when delivery has a different requirement.

## Ordinary delivery

```sh
forgedoc build DOC_onboarding.html
```

The document gets exact-version CDN links. Commit the small HTML file, send it to a reader, or serve it as a static page. Opening it requires network access for resources the browser has not already cached.

A rebuild recognizes the previously injected runtime. Edit the author content in the same file and build again. Do not regenerate the runtime by hand.

## Offline delivery

```sh
forgedoc build DOC_onboarding.html --offline
```

This embeds CSS, JavaScript, and Mermaid. The default output is under `.temp/`, leaving the ordinary input document intact. The embedded runtime is several megabytes, so treat it as a delivery artifact.

An author-supplied remote image or external hyperlink is still remote. Offline mode embeds ForgeDoc's runtime; it cannot make every third-party resource in the author content available offline. Bundle required author assets locally or embed them yourself.

To verify the result, open the offline artifact with the network disconnected. Check the actual features you used, including diagrams and required images.

## Keep a history

```sh
forgedoc build PLAN_vendor-orders.html --history
```

History mode establishes a folder with one current entry point and numbered snapshots:

```text
PLAN_vendor-orders/
  index.html
  history/
    0001-2026-07-28.html
    0002-2026-08-04.html
```

Continue editing and building `PLAN_vendor-orders/index.html --history`. A build that makes no content change does not add another snapshot. Share the current `index.html` entry point so feedback stays attached to the intended version.

## Choose an explicit output

```sh
forgedoc build DOC_onboarding.html --out public/onboarding.html
forgedoc build DOC_onboarding.html --offline --out delivery/onboarding.html
```

An explicit output keeps the source intact and writes the built document elsewhere. Use it when a site or build pipeline owns the delivery path.

## Choose a theme

```sh
forgedoc build DOC_onboarding.html --theme geist
```

Or put the choice in the source placeholder:

```html
<style>/*@DOC_CSS:geist@*/</style>
```

The CLI flag takes precedence for that build. Read [themes and customization](/docs/themes/) for the distinction between a build-time stylesheet and light/dark appearance within it.

## Diagnose delivery failures

If a CDN document fails to enhance, check resource access and script placement. If a file works online but fails offline, check whether you opened the artifact from `.temp/` and whether author content still points to remote assets. Run `forgedoc validate <file> --built --format=json` to check the built form.
