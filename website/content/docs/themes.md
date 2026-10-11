---
title: Themes
description: Default, Geist, Bun, and ForgeDoc—choose a visual character, then customize presets, tokens, and public parts.
---

A ForgeDoc document ships one theme stylesheet, selected at build time. Light and dark appearance are handled inside that stylesheet. Choosing a different theme and changing the color scheme are different operations.

## Available document themes

| Theme | Character |
| --- | --- |
| `default` | The default document theme, with Plus Jakarta Sans and JetBrains Mono |
| `geist` | A tighter technical theme, with Geist Sans and Geist Mono |
| `bun` | Higher contrast and heavier display type |
| `forgedoc` | The original teal editorial theme |

Every theme renders the same semantic component vocabulary. You can change a
document's visual character without rewriting its sections, questions, code,
or feedback. Pick the stylesheet at build time; light/dark color schemes work
within the selected theme.

## Default

The general-purpose document theme. Plus Jakarta Sans gives prose and headings
a consistent reading voice, while JetBrains Mono handles code. Both typefaces
are vendored and embedded in the compiled stylesheet.

```sh
forgedoc build DOC_guide.html --theme default
```

This is the theme used when no theme is requested. It is a useful starting point
for guides, onboarding, proposals, and documents that mix prose with technical detail.

## Geist

A tighter technical presentation using Geist Sans and Geist Mono. The fonts are
vendored and embedded, so the typography survives an offline handoff. Use it for
API references, implementation notes, and dense technical documentation.

```sh
forgedoc build DOC_api.html --theme geist
```

## Bun

A high-contrast theme with a pink interaction accent, heavier Archivo display
type, and Martian Mono for code. Body copy uses system sans-serif fonts.

```sh
forgedoc build DOC_release.html --theme bun
```

Bun currently references its display and monospace fonts at `bun.com`. When those
resources are unavailable, it falls back to the system font stack. The CLI's
offline mode embeds the document runtime, but does not vendor these remote Bun
font files. Choose Default or Geist if exact font availability is part of the
offline requirement.

## ForgeDoc

The original teal editorial theme, with a generous reading measure and system
sans-serif and monospace stacks. It is also the reference theme used when
checking the token contract shared by the themes. It ships no web fonts.

```sh
forgedoc build DOC_proposal.html --theme forgedoc
```

## Select and preserve a theme

```sh
forgedoc themes
forgedoc themes --format=json
forgedoc build DOC_api-guide.html --theme geist
```

To carry the choice in the source, use `/*@DOC_CSS:geist@*/` in the style placeholder. A later rebuild retains the recorded theme. A theme with vendored fonts embeds them in its stylesheet for offline delivery.

## Presets first

```html
<doc-page doc-id="api-guide" density="compact" scale="md" accent="indigo">
  <doc-section title="API overview">
    <p>The account endpoint returns the current user's profile.</p>
  </doc-section>
</doc-page>
```

| Axis | Values |
| --- | --- |
| `density` | `compact`, `comfortable`, `spacious` |
| `scale` | `sm`, `md`, `lg` |
| `accent` | `teal`, `indigo`, `slate`, `plum`, `amber` |

See [doc-page](/docs/reference/doc-page/) for defaults and other page attributes. Presets are validated and are the most stable way to request a different presentation.

## Tokens second

```css
doc-note {
  --doc-accent-600: #8b5cf6;
}
```

Tokens inherit, so you can scope a change to a subtree. An inline token override is an escape hatch when an individual block needs it:

```html
<doc-table style="--doc-space-unit: 3px">
  <table>
    <thead><tr><th>Field</th><th>Meaning</th></tr></thead>
    <tbody><tr><td>id</td><td>Account identifier</td></tr></tbody>
  </table>
</doc-table>
```

Use the documented token contract and check the result in the chosen theme. A raw theme-internal selector is less stable than a semantic token.

## Public parts third

```css
doc-note [data-part="title"] {
  letter-spacing: 0.02em;
}
```

All library styles live inside ordered `@layer doc.*` layers, so unlayered author CSS wins without `!important`. `data-part` names and custom states are the public styling surface; runtime class names and generated nesting are internal.

Some content parts exist only when the author wrapped that content in an ordinary element. A bare text node cannot receive `data-part`. The component reference marks those cases; style the host when needed.

## This handbook's appearance

The Fumadocs website has its own light/dark switch and uses self-hosted Google Sans Flex for the interface and reading text, with JetBrains Mono for code and small technical labels. Those fonts belong to the website. They do not change the default theme of a ForgeDoc HTML document.
