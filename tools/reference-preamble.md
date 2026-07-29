# PlanKit reference

The complete per-component API. For the one-page version an authoring agent
should keep open, see [CHEATSHEET.md](./CHEATSHEET.md).

**Attributes** are what the agent writes. **Parts** are the public `data-part`
surface. **States** are custom states, targetable as `:state(name)`. Everything
else — class names, element structure, the shape of generated chrome — is
internal and will change.

## How to read this

- A tag marked **generated** is created by the runtime. Writing it by hand is a
  build error.
- A tag marked **only valid inside** is a child-only tag; the validator rejects it
  elsewhere.
- A part marked with `*` exists only when the author wrapped that content in an
  element of their own. In the recommended authoring form that content arrives as
  a bare text node, and wrapping it would mean moving author content, which the
  runtime never does. Those components carry the typography on the host element
  instead — style `plan-quote` itself, not `plan-quote [data-part="body"]`.

## The three override tiers

In order of preference (§6.6):

1. **Preset attributes** — `<plan-doc density="compact">`. Validated against an
   enum, switchable at runtime with one `setAttribute`, and reachable from the
   print stylesheet.
2. **Token override** — `plan-note { --plan-accent-600: #8b5cf6 }`. Semantic, and
   survives a library upgrade. Custom properties inherit, so this works on any
   subtree: `<plan-table style="--plan-space-unit: 3px">`.
3. **Raw CSS** — `plan-note [data-part="title"] { letter-spacing: .02em }`.

Tier 3 needs no `!important` and no specificity arithmetic. Every rule the
library ships lives inside `@layer plan.*`, and unlayered author CSS beats layered
CSS outright:

```css
/* wins against every shipped rule */
plan-note {
  border-radius: 0;
}
```

Only `data-part` selectors are public API. Internal class names are not, and will
change without a major version.

## ARIA

The agent never writes `role=` or `aria-*`. Components set them through
`ElementInternals` at upgrade, which keeps accessibility semantics out of the
markup the agent has to remember and out of the DOM an author might edit.
