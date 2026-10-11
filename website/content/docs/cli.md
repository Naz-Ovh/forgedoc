---
title: CLI reference
description: The build, validation, scaffolding, and discovery commands available in the forgedoc binary.
---

The CLI operates directly on HTML files. It does not need a service, daemon, or project configuration. Install it with `npm install -g forgedoc`, or invoke it with `npx forgedoc`.

## Build

```text
forgedoc build <file.html> [--history] [--offline] [--theme <name>]
  [--out <file>] [--no-validate]
```

| Option | Effect |
| --- | --- |
| No mode flags | Validate and rewrite the file with exact-version CDN links |
| `--offline` | Embed the runtime, including Mermaid; output under `.temp/` by default |
| `--history` | Maintain a current `index.html` and numbered snapshots |
| `--theme <name>` | Select the stylesheet for this build |
| `--out <file>` | Write elsewhere and preserve the input |
| `--no-validate` | Bypass validation; use only when you deliberately accept unchecked markup |

See [build and delivery](/docs/guides/delivery/) for output paths and revision behavior. A validation failure aborts the build before writing output.

## Validate

```text
forgedoc validate <file.html> [--format=json] [--built]
```

Use `--built` to validate injected output instead of expecting source placeholders. JSON diagnostics expose precise locations and suggested fixes.

```sh
forgedoc validate DOC_guide.html --format=json
forgedoc validate .temp/DOC_guide.html --built --format=json
```

The diagnostic fields are `file`, `line`, `column`, `ruleId`, `severity`, `message`, and `fix`. A validation result also reports its `ok` status and counts.

## Scaffold

```text
forgedoc new <name> [--dir <path>]
```

```sh
forgedoc new onboarding --dir documents
```

The name is slugified, and the scaffold uses `DOC_<slug>.html`. The generated file has the runtime placeholders and a starting document structure.

## Discover the vocabulary

```sh
forgedoc cheatsheet
forgedoc elements
forgedoc elements --format=json
forgedoc info doc-choice
forgedoc info choice --format=json
forgedoc search "code"
forgedoc reference
```

`info` accepts names with or without the `doc-` prefix. Discovery commands derive their information from the markup contract and documentation data used by validation. This is the quickest way for an agent to look up an attribute without inventing one.

`elements` can filter by category with `--category`. Search covers tag names, descriptions, attributes, and documentation text.

## Themes, version, and help

```sh
forgedoc themes --format=json
forgedoc version
forgedoc --version
forgedoc help
forgedoc --help
```

## Exit status

Successful operations return `0`. Invalid markup returns `1`. Some invalid flags and unsupported combinations return `2`; missing input and unknown commands can return `1`. Treat any nonzero code as failure rather than assuming all usage failures have one uniform status.

An automation should retain stderr for build and validation messages and parse stdout only when the command's requested output format is JSON.
