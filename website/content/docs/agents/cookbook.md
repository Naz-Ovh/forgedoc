---
title: Task cookbook
description: Concrete prompts and execution patterns for documentation, decision reviews, and feedback-driven revisions.
---

These patterns describe work to complete, not a mandatory planning workflow. Adapt the content to the source and reader in front of you.

## Document a module directly

```text
Read the implementation and tests for the account module.
Write DOC_account-module.html using ForgeDoc semantic markup.
Explain the public API, show working usage, and include troubleshooting.
Do not add review questions unless an actual decision is unresolved.
Validate and build the file, then report the output path.
```

Execution: inspect exports, callers, and tests; choose guide or reference sections; use `doc-code` for working samples; invoke `forgedoc build`. A coding task does not need to be turned into a proposal first.

## Produce a reviewable decision

```text
Write PLAN_vendor-inbox.html for shared vendor read state.
Explain the proposed behavior, data changes, failure cases, and verification.
Represent the one unresolved read-state decision with doc-choice.
Recommend an option and explain the cost of each alternative.
Build the document with ForgeDoc.
```

Execution: make the behavior concrete; use only actual open choices; preserve stable wording after handoff; hand back the built file and a brief description of what needs an answer.

## Apply a pasted feedback bucket

```text
Read this FB v1 bucket against PLAN_vendor-inbox.html.
Match anchors, question wording, and quoted text before applying decisions.
Replace settled questions with prose and resolve corrections in place.
Rebuild the same file. Report what changed and what remains open.
```

Execution: process every valid item; ask about ambiguous matches; preserve document identity. A renamed copy is not a revision strategy.

## Recover from a validation error

```sh
forgedoc validate DOC_account-module.html --format=json
forgedoc info doc-code --format=json
forgedoc search "parameters"
```

Fix the reported line using the actual contract. Do not invent a new element to silence a failure and do not routinely disable validation.

## Create a network-independent handoff

```sh
forgedoc build DOC_account-module.html --offline --out delivery/account-module.html
```

Check the delivered file with network unavailable. If the author added remote images, handle those assets explicitly. Offline runtime bundling is not automatic archival of arbitrary web resources.

## Modify ForgeDoc itself

Start with root `AGENTS.md`, then find the owning module. Preserve light DOM, in-place enhancement, prose-host layout, offline bundling, and the framework boundary. Use the [contribution contract](/docs/agents/contributing/) and run `npm run check` before finishing.
