---
title: Installation
description: Install the CLI, browser runtime, and agent skills using the method that fits your environment.
---

The ForgeDoc CLI requires Node.js 20 or newer. Choose a global install for
regular authoring, a one-off runner to try it, or a project-local version for
repeatable team builds. Browser integrations can use npm or a direct CDN.

## Choose an installation method

| Method | Best for |
| --- | --- |
| [Global CLI](#global-cli) | Repeated authoring across projects |
| [One-off execution](#one-off-execution) | Trying ForgeDoc without a global install |
| [Project-local CLI](#project-local-cli) | A reproducible tool version shared by a team |
| [Browser runtime via npm](#browser-runtime-via-npm) | Browser integrations with an existing bundler |
| [Direct CDN](#direct-cdn) | Loading the runtime into HTML without a bundler |
| [Agent skills](#agent-skills) | Teaching an agent the authoring and feedback workflow |
| [From source](#from-source) | Developing or testing ForgeDoc itself |

### Global CLI

Choose one package manager:

```sh
# npm
npm install -g forgedoc

# pnpm
pnpm add -g forgedoc

# Bun package manager; the CLI still uses its Node shebang
bun add --global forgedoc
```

Then check `forgedoc version`. If the binary is not found, add your package
manager's global binary directory to `PATH`, or use the one-off method below.
Modern Yarn users can use `yarn dlx` or a project-local dependency.

### One-off execution

Each command downloads or reuses a cached package and runs its binary:

```sh
npx forgedoc new vendor-orders
pnpm dlx forgedoc new vendor-orders
yarn dlx forgedoc new vendor-orders
bunx forgedoc new vendor-orders
```

Run only the command for your package manager. Use the same runner for the build,
for example `npx forgedoc build DOC_vendor-orders.html`. Yarn's `dlx` command is
for modern Yarn; project-local installation works for both modern and Classic Yarn.

For a repeatable one-off invocation, pin the package version:

```sh
npx forgedoc@2.1.0 build DOC_vendor-orders.html
```

See the package-manager documentation for [pnpm dlx](https://pnpm.io/cli/dlx),
[Yarn dlx](https://yarnpkg.com/cli/dlx), and [bunx](https://bun.sh/docs/pm/bunx).

### Project-local CLI

Use this when ForgeDoc is a build tool in an existing project. Choose one pair:

```sh
# npm
npm install --save-dev --save-exact forgedoc@2.1.0
npx forgedoc version

# pnpm
pnpm add --save-dev --save-exact forgedoc@2.1.0
pnpm exec forgedoc version

# Yarn
yarn add --dev --exact forgedoc@2.1.0
yarn forgedoc version

# Bun
bun add --dev --exact forgedoc@2.1.0
bunx forgedoc version
```

Commit the package manifest and lockfile. npm scripts resolve the local binary,
so a project can add `"docs:build": "forgedoc build DOC_guide.html"` to its scripts.

### Browser runtime via npm

If browser code imports the runtime, use a regular dependency instead of a CLI-only
development dependency:

```sh
npm install forgedoc
```

The equivalent commands are `pnpm add forgedoc`, `yarn add forgedoc`, and
`bun add forgedoc`. Load the runtime after the document's authored children exist:

```js
import { store, vocabulary } from 'forgedoc';
import 'forgedoc/style.css';

const documentStore = store(document.querySelector('doc-page'));
```

This import registers custom elements and requires browser DOM APIs. In an SSR
application, load it on the client after mounting the author markup. It is not a
Node-only validation library. Read the [JavaScript API](/docs/runtime-api/) before
using package exports.

### Direct CDN

For hand-maintained browser HTML, add these resources to the head:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/forgedoc@2.1.0/dist/forgedoc.css" />
<script defer src="https://cdn.jsdelivr.net/npm/forgedoc@2.1.0/dist/forgedoc.iife.js"></script>
```

Use an exact published version. `defer` ensures the runtime registers elements
after their children are parsed. The ordinary CLI build inserts those pinned
links for you, so use the placeholder-based source below for agent authoring.

Direct CDN loading needs network access. For a self-contained document, use the
CLI's [offline build](/docs/guides/delivery/#offline-delivery) instead of a remote script.

### Agent skills

```sh
npx skills add naz-ovh/forgedoc
```

This installs `better-plan` and `better-docs` into the agent environments you choose.
Add `-g` to install skills globally. The skills teach the authoring vocabulary and
feedback loop; install the ForgeDoc CLI separately so the agent can build its output.

See [the agent handbook](/docs/agents/) for direct use without an installed skill.

### From source

```sh
git clone https://github.com/naz-ovh/forgedoc.git
cd forgedoc
pnpm install --frozen-lockfile
npm run build
node dist/cli.js version
```

This uses the repository's pinned package manager and builds the runtime and CLI.
Read root `AGENTS.md` before modifying code. The [contribution guide](/docs/contributing/)
covers checks, Chromium setup, and the separate handbook application.

## Next step

Continue to [Quick Start](/docs/quick-start/) to build a complete document,
collect feedback, and send it back to your AI.
