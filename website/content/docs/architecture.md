---
title: Architecture
description: The contract, enhancement lifecycle, persistence, feedback, styles, and build pipeline behind the document runtime.
---

ForgeDoc preserves the reader's connection to author content. Most of its unusual implementation choices follow from that requirement: selection must keep working, comments must restore, and generated UI must not force the author to write presentation code.

## The data flow

```text
src/core/contract.ts ────────┬── tools/validate.ts → CLI diagnostics
                            ├── tools/docs.ts → reference / cheatsheet / info
                            └── src/index.ts → element registration

Author HTML → CLI validate → inject assets → built HTML
                                              ↓
                              custom elements enhance in place
                                              ↓
                                 per-document store
                                              ↓
                              bucket / question drawer
                                              ↓
                                      FB v1 text
```

The contract is plain data with no DOM dependency. Browser runtime and Node tooling share it without importing browser classes into validation.

## Light DOM

Custom elements extend `HTMLElement` and keep content in the light DOM. There is no shadow root. Selection APIs, find-in-page, printing, and feedback anchoring can all see the same text the reader sees.

The cost is that styles need a deliberate public contract. ForgeDoc uses CSS layers, `--doc-*` tokens, public `data-part` names, and custom states rather than a shadow boundary.

## Enhance in place

`DocElement.connectedCallback()` guards against duplicate enhancement, sets up listener cleanup, and calls the element's `enhance()`. A component reads author content, sets attributes, and appends generated chrome around it.

Moving a text node invalidates live ranges. Ordinary enhancements therefore preserve author node identity. Code, diff, and tree rendering have documented content transformations; disclosure content-region handling has its own documented exception. Read the source's `// why:` comments and the current §2.2 specification before changing these sites.

`disconnectedCallback()` aborts listeners registered through the base helper and runs teardown. When adding observers or timers, release them explicitly in teardown.

## Prose hosts stay block containers

If a custom-element host contains loose text between element children, making the host a grid or flex container turns that text into anonymous layout items. A sentence can then split into unintended rows or columns.

Keep author-prose hosts as block containers. Use positioned chrome or a runtime-created child region for layout. This constraint applies to the document runtime, not to the entirely separate Fumadocs website.

## One store per page

`src/core/store.ts` uses a `WeakMap` keyed by the `doc-page` element. The store is created lazily, so child components do not depend on the parent having upgraded first.

Components use the shared store rather than reading local storage independently. There is one stored state blob, a write/read/delete availability probe, debounced writes, and schema migration for older blobs. This reduces storage work and keeps state behavior consistent across controls.

## Feedback anchoring

Text feedback stores an anchor ID, character offsets, and the selected quote. Those are independent ways to locate the comment after reload. Block feedback anchors to a figure or listing itself, since a rendered image has no useful text selection.

Runtime UI is marked so selection and text walking can exclude it. Without that exclusion, an old comment could match its own quoted text inside the feedback panel.

The serializer and parser round-trip against `tests/golden/bucket-v1.txt`. Preserve that compatibility when changing feedback behavior.

## Svelte has a narrow job

The bucket and question drawer are runtime-created DOM, so Svelte can own them. Custom elements that enhance author DOM remain vanilla classes. Svelte custom-element mode is avoided because its inline component styles would sit outside the library's intended layer and token system.

## Build variants

`npm run build` uses tsdown, compiles theme styles, and emits declarations with TypeScript. Vite serves development and runs tests; it does not produce the published `dist/` package.

| Artifact | Use |
| --- | --- |
| ESM runtime | Bundler/browser integration |
| CDN IIFE | Pinned links in ordinary documents |
| Standalone IIFE | Embedded, offline documents, with Mermaid bundled |
| CLI | Scaffolding, validation, injection, and discovery |
| Theme CSS | One selected stylesheet per built document |

IIFE output is required for offline `file://` usage because ESM loading has browser origin restrictions. Optional Mermaid handling differs across builds; ensure the standalone artifact really bundles it.

## What tests protect

Vitest runs Node tooling tests and browser component tests in real Chromium. The repository checks no shadow DOM, contract coverage, generated-reference consistency, fixture completeness, feedback round trips, and delivered artifact behavior.

Appearance is intentionally not asserted. Inspect themes visually; do not pin screenshots, geometry, or computed styles as tests.

Continue with [contribution workflow](/docs/contributing/) and the [coding agent guide](/docs/agents/contributing/).
