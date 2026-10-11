---
title: Coding in ForgeDoc
description: A focused implementation contract for agents changing the library rather than authoring a document.
---

This page is for code changes in the ForgeDoc repository. Root `AGENTS.md` is the authoritative local instruction file; read it before touching the project.

## Find the cause and owning surface

For a runtime bug, follow the markup into its `DocElement` class, store interaction, and generated UI. For a build bug, inspect `tools/cli.ts`, `tools/inject.ts`, and the tsdown configuration. For a contract mismatch, compare `src/core/contract.ts`, `tools/element-docs.ts`, and validator tests.

Do not fix a content transformation problem with a broad DOM rewrite. Identity and range preservation are part of the product's behavior.

## Preserve these constraints

| Constraint | Implementation implication |
| --- | --- |
| Light DOM only | Never introduce `attachShadow` in runtime source |
| Enhance in place | Do not move ordinary author nodes; read documented exceptions before changing them |
| Prose hosts are blocks | Do not make mixed-prose custom element hosts flex/grid containers |
| Offline `file://` works | Keep standalone IIFE bundling and local runtime resources intact |
| Runtime is injected | Do not ask document authors or agents to emit library CSS/JS |
| Vanilla elements | Use Svelte only for runtime-created bucket and question UI |

Every constraint-shaped site needs a `// why:` comment. Prefer the existing lifecycle, part-scoping, and store helpers instead of creating competing mechanisms.

## Keep source and contract synchronized

When changing a tag, update the contract, implementation, registration if needed, documentation metadata, theme/structural styles, and kitchen-sink coverage. Regenerate reference documentation with `npm run docs:generate`.

Published API identity is stable: binary `forgedoc`, global `ForgeDoc`, and `forgedoc.*` artifact names. Do not rename them for code cleanup.

## Build traps

- tsdown `define` belongs under `transform`.
- Standalone Mermaid must be explicitly bundled despite the optional peer dependency.
- `@mermaid-source` requires the resolver plugin to win over tsconfig paths.
- Concurrent tsdown configs must not individually clean the shared output directory.
- A Svelte prop named `state` interferes with `$state()` rune resolution.
- Biome must not format Svelte files or verbatim fixtures.

These can produce a successful build with incorrect behavior. Verify the delivered artifact, not just the command's exit status.

## Finish with evidence

Run the relevant behavioral check, then `npm run check`. Use real Chromium for element behavior. Do not add screenshot, computed-style, or geometry assertions. Report what changed, why it fixes the problem, and any verification you could not complete.

The Fumadocs app under `website/` has a separate package and typecheck. React and Next.js are used there only; they do not authorize a framework migration of ForgeDoc's custom elements.
