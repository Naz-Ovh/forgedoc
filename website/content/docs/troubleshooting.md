---
title: Troubleshooting
description: Diagnose build, loading, persistence, markup, and integration problems from the actual contract.
---

Start with the smallest failing artifact: the source HTML, a built file, or a browser integration. Validate that artifact before changing unrelated code.

## Build writes no output

Validation happens before injection. Read the reported file, line, column, rule ID, and suggested fix.

```sh
forgedoc validate DOC_guide.html --format=json
forgedoc info doc-choice
```

Check for a missing `doc-id`, required child tags, invalid enum values, unknown attributes, and hand-authored generated elements. `--no-validate` suppresses the check; it does not fix the markup.

## The page looks like plain HTML

Check whether you opened an unbuilt source with placeholders. Build it, then check the browser's resource and script errors. A default build needs its pinned CDN resources; an offline build should be opened from the output path reported by the CLI.

Place the placeholder script at the end of the body. With a direct external script, use `defer`. Do not load the runtime halfway through parsing author content.

## An offline page still uses the network

Confirm you opened the embedded artifact from `.temp/` or the explicit `--out` path. Check author images, fonts, links, and other resources. ForgeDoc embeds its own runtime; it cannot automatically embed arbitrary third-party author assets.

## Answers do not survive a reload

Check for the storage warning. Restricted storage may leave the document usable only for the current session. Copy feedback before navigating away.

Make sure distinct documents have distinct `doc-id` values. Revisions of the same document should keep the same one. State is local to a browser storage context and does not automatically synchronize between people or devices.

## A comment is orphaned after a revision

The runtime could not confidently locate its original anchor and quote. Review the comment against the revised prose. Do not force an old offset onto unrelated text; preserve wording and anchors where it makes sense, then use the copied feedback to resolve the change.

## A code block has the wrong content

Code is still inside an HTML document. Escape `<` and `&` in verbatim samples when needed. Verify `textContent` contains the intended source, preserve significant whitespace, and choose a language from the [allowlist](/docs/reference/#code-language-allowlist).

## A Mermaid diagram fails

Check the diagram source and the `type="mermaid"` figure. A CDN build may need network access for its lazy-loaded dependency. The standalone build should include Mermaid; an unexpectedly tiny standalone artifact is a build configuration problem, not successful offline bundling.

## A package import fails

Read [the JavaScript API](/docs/runtime-api/) before importing a function seen in the source tree. `parseBucket` and `TAGS` are not current top-level package exports. The runtime import requires a browser environment; it is unsuitable for Node-only validation or server rendering.

## A theme override has no effect

Use preset attributes first, then tokens, then public `data-part` selectors. Check whether the part exists for bare-text content. Do not target private class names, and do not assume setting a root-level derived token will recompute a subtree's values.

## A source change builds but behaves incorrectly

Check the build traps in root `AGENTS.md`: `transform.define`, explicit Mermaid bundling, `@mermaid-source` resolution, and concurrent tsdown cleanup. Build success alone does not prove that the intended variant shipped.
