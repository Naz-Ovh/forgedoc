---
title: Contributing
description: Find the owning module, preserve the document constraints, and run the repository's required checks.
---

Read the root `AGENTS.md` before editing. It records the constraints, known toolchain traps, and conventions needed to make a correct change. Use the implementation and tests as the current source of truth; older specification sections may describe superseded tooling.

## Set up

```sh
git clone https://github.com/naz-ovh/forgedoc.git
cd forgedoc
pnpm install --frozen-lockfile
npm run build
npm test
```

The repository pins pnpm in `package.json`. Use that package-manager version for reproducible installs. Browser tests need Chromium available through Playwright. `pnpm exec playwright install chromium` installs it when your environment does not already provide it.

## Find the change's owner

| Area | Location |
| --- | --- |
| Element lifecycle, identity, numbering, store | `src/core/` |
| Authored elements | `src/components/doc-*.ts` |
| Selection, feedback serialization, bucket UI | `src/bucket/` |
| Question scraping and drawer UI | `src/questions/` |
| Shared structural styling | `src/styles/base/` |
| Theme appearance and tokens | `src/styles/themes/` |
| CLI, validator, asset injection | `tools/` |
| Element documentation prose and examples | `tools/element-docs.ts` |
| Published agent instructions | `skills/better-plan/`, `skills/better-docs/` |
| This handbook | `website/` |

## Change the contract and runtime together

When adding an element or attribute, update the owning contract entry and implementation. A complete element also needs registration, styles, documentation metadata, and kitchen-sink coverage. These are connected responsibilities, not optional follow-ups.

1. Add the tag's attributes, nesting rules, parts, and states in `src/core/contract.ts`.
2. Implement its named class in `src/components/` with the `DocElement` lifecycle.
3. Import and register it in `src/index.ts`.
4. Add structural and theme styles in the appropriate ordered imports.
5. Add prose, category placement, examples, and related tags in `tools/element-docs.ts`.
6. Add a representative kitchen-sink fixture and meaningful behavioral coverage.

Regenerate documentation:

```sh
npm run docs:generate
```

The website derives its component pages from the generated reference during preparation. Update the shared source instead of editing the website's generated reference directory.

## Keep the conventions

- Prefer named exports. Tool configuration and Next.js route modules use default exports only where their frameworks require them.
- Give exported functions explicit return types.
- Put `// why:` at constraint-shaped implementation sites.
- Keep functions short and nesting shallow.
- Record every new dependency and its reason in `docs/DECISIONS.md`.
- Leave verbatim fixtures and Svelte formatting alone unless the change requires them.

Svelte props must not be named `state` in a file that uses the `$state()` rune. Biome formatting is excluded for `.svelte` files because it corrupts their intended formatting.

## Verify the change

```sh
npm run check
```

This runs formatting, lint, type checking, build, and tests. Add behavioral tests for meaningful changes, especially selection restoration, persistence, validation, and delivery. Avoid tests that merely repeat the implementation or pin minifier output.

For delivered-artifact behavior:

```sh
npm run test:visual
```

Despite the historical command name, this suite checks behavior, including offline documents and themed builds. It does not assert appearance.

## Preview appearance

Use `npm run dev` for the kitchen-sink development page and `npm run preview` for theme inspection. Look at the themes you changed; do not introduce screenshot assertions.

For handbook changes, use [the website development instructions](https://github.com/naz-ovh/forgedoc/blob/main/website/README.md).
