# Building: themes, offline, and keeping versions

The normal build is one line and rewrites the document in place:

```sh
npx forgedoc build PLAN_<name>.html
```

Everything below is for a reader who asked for something else.

## Check before you build

```sh
npx forgedoc validate PLAN_<name>.html --format=json
```

The build validates anyway and writes nothing on failure, so this is only worth
running on its own when you want the errors as JSON.

## Themes

A document carries one theme, chosen at build time. Name it in the placeholder
so a rebuild months later produces the same document:

```html
<style>/*@DOC_CSS:geist@*/</style>
```

Leave the placeholder bare for the default. `npx forgedoc themes` lists what this
installation can build with. The theme rides along in the built file, so later
rebuilds keep it without being told.

## Offline delivery

```sh
npx forgedoc build PLAN_<name>.html --offline
```

Use this only when the reader truly has no network. It embeds the whole runtime,
reaches several megabytes, and writes into `.temp/` rather than over your
document — that file is something you send, not something you commit.

The normal build links a version-pinned CDN and stays around 15 kB, which is
small enough to commit and to read in a diff.

## Keeping past versions

By default the document is one file that always shows the current plan. Older
versions are not kept, because a folder of near-identical plans is how a reader
ends up commenting on the wrong one.

When the reader explicitly asks for a history, add `--history`:

```sh
npx forgedoc build PLAN_<name>.html --history
```

The document moves into a folder of its own and keeps its own record:

```text
PLAN_vendor-orders/
  index.html                    ← the current plan, and the only file to open
  history/
    0001-2026-07-28.html
    0002-2026-08-04.html
```

Build `PLAN_vendor-orders/index.html --history` from then on. Each build adds the
version it published; a rebuild that changes nothing adds nothing.

## Writing somewhere else

```sh
npx forgedoc build PLAN_<name>.html --out <target.html>
```

This leaves the source file with its placeholders intact and writes the built
document elsewhere. Use it when something outside the plan owns the output path —
a docs site, a build directory. For ordinary work the in-place build is what you
want, because it keeps one file rather than two that drift apart.
