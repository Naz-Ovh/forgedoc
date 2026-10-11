---
title: About
description: A document runtime for the conversation between an author, a reader, and an agent.
---

ForgeDoc turns semantic HTML into readable, interactive documents. You write the content and the decisions. The runtime supplies layout, navigation, accessible controls, light and dark appearance, local persistence, and a feedback bucket the reader can copy back to you.

Created by [H. Nazmul Hasan](https://naz.ovh), a software developer based in Dhaka, Bangladesh.

It is useful whenever a document needs a response: an engineering proposal, a design review, a runbook with a checklist, or an onboarding guide with open questions. It also renders ordinary technical documentation. You do not need to ask a question to use it.

## Choose your starting point

| You want to… | Read |
| --- | --- |
| Install the CLI, runtime, or agent skills | [Installation](/docs/installation/) |
| Build a working document in a few minutes | [Quick start](/docs/quick-start/) |
| Collect feedback and send it back to an AI | [The feedback collector](/docs/feedback/) |
| Understand the exact pasted feedback contract | [FB v1 format](/docs/feedback-format/) |
| Explore the component vocabulary | [Component reference](/docs/reference/) |
| Pick Default, Geist, Bun, or ForgeDoc | [Document themes](/docs/themes/) |
| Learn the structure of the markup | [Authoring model](/docs/authoring/) |
| Write a tutorial, runbook, or API guide | [Documentation recipes](/docs/guides/documentation/) |
| Send decisions back to a coding agent | [Feedback and revisions](/docs/feedback/) |
| Integrate the runtime into browser tooling | [JavaScript API](/docs/runtime-api/) |
| Change ForgeDoc itself | [Architecture](/docs/architecture/) and [Contributing](/docs/contributing/) |
| Give an agent the complete authoring contract | [Agent guide](/docs/agents/) |
| Look up a tag and its exact attributes | [Component reference](/docs/reference/) |

## One document, one loop

```text
Author writes semantic HTML
          ↓
forgedoc build validates and injects the runtime
          ↓
Reader opens the document, chooses options, adds comments
          ↓
Copy feedback → paste the FB v1 block back to the author
          ↓
Author revises the same document and rebuilds
```

The default build rewrites the input file with version-pinned CDN links. A later build recognizes those links and rewrites the same document again. Use the offline mode to embed the runtime when the reader cannot rely on network access.

## What you write

```html
<doc-section title="The approach">
  <p>Use one shared inbox for the vendor team.</p>
</doc-section>

<doc-choice mode="single" question="Should read state be shared?">
  <doc-option recommended>Shared team inbox</doc-option>
  <doc-option>Per-person read state</doc-option>
</doc-choice>
```

The section number, option letters, controls, and feedback UI come from the runtime. A complete document also needs the shell and two runtime placeholders; the [quick start](/docs/quick-start/) includes them.

## Three different things

**The npm package** is `forgedoc`. It includes the CLI and runtime builds. **The installable skills** teach agents how to write plans and documentation with the library. **This handbook** is a Fumadocs website that explains both.

The website uses Next.js and React. ForgeDoc's author-facing custom elements use plain `HTMLElement` subclasses. Those are separate applications with different responsibilities.

## Read without the interface

Every page has an **Open Markdown** action. [/llms.txt](/llms.txt) indexes the handbook; [/llms-full.txt](/llms-full.txt) contains it in one file. These make the documentation easier to retrieve in an agent session. Publishing them does not guarantee that any model provider will include the project in training.
