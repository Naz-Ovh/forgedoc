# Documentation website

Read the root `AGENTS.md` as well. This is a separate Fumadocs/Next.js app;
its React dependencies do not belong to the ForgeDoc document runtime.

## Design decisions

Use Tailwind **Neutral** for body backgrounds, foreground text, borders, and
nested surfaces. Use Tailwind **Emerald** for accents: buttons, links, focus,
selection, active controls, and highlights. Keep this division in both modes.
Depth comes from different Neutral shades on parents and children. Document-theme
swatches retain their actual theme colors.

Google Sans Flex is the interface and reading font. JetBrains Mono is the code
and technical-label font. Both are self-hosted.

The feedback collector and the handoff back to AI are the landing page's main
story. Keep Components and Themes prominent in the main navigation, early in
the sidebar, and near the top or middle of the homepage.

The sidebar begins with **ForgeDoc**: **About**, **Installation**, **Quick Start**.
Installation has all supported installation routes; Quick Start is the focused
first-document walkthrough. Keep component categories collapsible, using native
Fumadocs folder groups so their public document URLs remain stable.
The FB v1 format has a separate reference page from the feedback workflow.

## Content and checks

The component reference is generated from the root's committed generated docs.
Edit `src/core/contract.ts` and `tools/element-docs.ts`, then regenerate it;
the website's ignored reference pages are derived content.

Use Fumadocs' `llms()` utility and processed Markdown from the same page source
as the UI. Builds must automatically emit `llms.txt`, `llms-full.txt`, and their
`llm.txt` / `llm-full.txt` aliases. The export check verifies page coverage and
alias equality.

Run `npm run docs:site:build`, `npm run docs:site:check`, and the root's
`npm run check`. Follow the root's policy of behavioral tests and manual appearance
inspection; do not add screenshot or geometry assertions.

Framework-required Next.js page/layout/metadata modules and tool configuration
use default exports. Other application modules use named exports.

## Hosting and authorship

The canonical public URL is `https://forgedoc.naz.ovh`. `lib/site.ts` owns the
canonical host and H. Nazmul Hasan's author identity (`https://naz.ovh/#person`).
Keep the linked landing-page credit small and near the top.

`npm run docs:site:deploy` builds and publishes the static export to Cloudflare
Workers using `website/wrangler.jsonc`. Only `forgedoc.naz.ovh` belongs to this
deployment; do not change the main `naz.ovh` site's routes. Credentials stay in
Wrangler's user configuration or environment variables, never in repository files.
