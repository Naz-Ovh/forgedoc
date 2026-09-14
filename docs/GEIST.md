# Geist theme

This theme maps ForgeDoc's semantic elements onto Vercel's Geist foundations.
It does not install Vercel's React components or claim that ForgeDoc-specific
components are official Geist components.

## Sources

Inspected against the live documentation on 2026-09-10:

| Foundation | Implementation |
| --- | --- |
| [Colors](https://vercel.com/geist/colors) | Published sRGB values for both schemes, namespaced as `--doc-geist-*`. Background 200 is the canvas; background 100 is the element surface; gray 400/500/600 are border states; gray 900/1000 are secondary/primary text. |
| [Typography](https://vercel.com/geist/typography) | Heading 40/24/20 (32px main sections on mobile), copy 20/16/14 and label 14/12. Weights 400, 500 and 600. Sizes scale with the documented `scale` preset. |
| [Materials](https://vercel.com/geist/materials) | 6px resting surfaces, 12px floating panels, subtle strokes and shadows. |
| [Note](https://vercel.com/geist/note) | Compact outlined callouts with a 16px icon and 14px copy. |
| [Choicebox](https://vercel.com/geist/choicebox) | Quiet option tiles with leading letter controls, semibold titles, a title-row recommendation badge, secondary descriptions, tinted selection and visible keyboard focus. |
| [Badge](https://vercel.com/geist/badge) | Subtle semantic pills without a competing outline. |
| [Collapse](https://vercel.com/geist/collapse) | Heading rows separated by rules, trailing chevrons and unboxed expanded content. |
| [Table](https://vercel.com/geist/table) | 14px labels, subtle headers, horizontal row rules and consistent cell padding. |

Comparison columns, process flows, roadmaps and feedback collection are ForgeDoc
adaptations using those foundations. Section numbers, density/scale/measure/accent
presets, persistent answers, native inputs and print expansion remain ForgeDoc
behavior. Components enhance the original DOM without moving author content.

## Fonts and offline delivery

Geist Sans and Geist Mono 1.7.2 are vendored under
`src/styles/themes/geist/fonts/`, with their SIL Open Font License. The stylesheet
builder embeds both WOFF2 files as data URLs. The generated HTML renders in Geist
with the network disabled; it does not depend on Google Fonts or jsDelivr.
The two fonts add approximately 190 kB before compression to the CSS.

Bun has its own copy of the previous component foundation under
`src/styles/themes/bun/foundation/`. It no longer imports Geist component styles.

## Preview and validation

Run `npm run build` and `npm run preview`. Open `.temp/preview-geist.html`.
The preview uses the complete kitchen sink, including nested sections and every
component. It is regenerated from the built stylesheet, not edited by hand.

`tests/visual/geist.spec.ts` verifies embedded fonts with network access blocked,
layout in both color schemes, persistent choices, and print behavior. Run it
after building with `npx playwright test tests/visual/geist.spec.ts`.
