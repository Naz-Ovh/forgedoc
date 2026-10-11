---
title: Feedback collector
description: Select prose, comment on blocks, answer questions, and send one structured feedback block back to your AI.
---

The feedback collector is the bridge from the reader back to the AI author. It
collects answers, notes, selected-text comments, and block comments into one
copyable bucket. The reader pastes that block back to the agent, which can then
revise the original document against concrete feedback.

## Collect feedback where you read

Select the sentence you want to discuss and add a comment. For a diagram,
image, code listing, diff, or tree, use the block's Comment button instead.
Answer a `doc-choice` when the document asks you to decide, and add a note if
the answer needs context.

The collector brings those interactions together. You do not need to reconstruct
the question, copy separate snippets, or describe the location from memory.
Answers and comments remain attached to their source in the document.

## Copy it back to the AI

Open the feedback bucket, review what you collected, and press Copy. Paste the
resulting `=== FB v1 ·` block into the author's conversation. The agent receives
the original question, selected labels, quoted text, comments, and anchor IDs.

This is a deliberate handoff: ForgeDoc does not automatically transmit reader
feedback to a provider or run a background AI request.

## What the AI receives

```text
=== FB v1 · vendor-orders · 2026-07-28T10:22:31Z · 2 items ===

[1] ANSWER q-should-read-state-be-shared
q: Should read state be shared across the vendor team?
a: Shared team inbox
n: only if we can still see who marked it read

[2] COMMENT sec-the-approach
at: 1 The approach
> Every order has a clear owner
c: Can an order have two owners during a handover?

=== end FB v1 ===
```

The format preserves labels and question wording so an agent can read it in a
fresh session. See the dedicated [FB v1 format reference](/docs/feedback-format/)
for fields, continuation lines, block comments, and parsing behavior.

## Match before applying

1. Match the anchor ID first, then the quoted text or block description.
2. Treat the option label as authoritative, rather than an A/B letter that may have changed.
3. Attach an answer only when the original question text matches word for word.
4. Process valid items even if another item is malformed. Report the item that could not be read.
5. Treat an Other answer as the reader's own proposal.

If the document has changed so much that the question or label no longer matches, ask for clarification. A plausible guess can quietly apply a decision to the wrong work.

## Revise the same file

A settled decision becomes a sentence explaining what was chosen and why. Remove the answered `doc-choice`. Preserve the document's `doc-id`, update the original HTML file, and build again.

For comments, respond where the information belongs:

- Answer a question in the relevant paragraph.
- Apply a correction in the original source.
- Represent an unresolved disagreement with a real choice and fair alternatives.

Tell the reader what changed and what remains open. Repeatedly asking an already answered question makes the document look as though the feedback was ignored.

## Persistence and its limits

State belongs to the reader's browser, under `forgedoc:<doc-id>:state`. There is no server synchronization, shared reviewer database, or automatic feedback delivery. Two people opening the same HTML file have separate browser state.

The store probes storage with a real write/read/delete operation. If it cannot persist, the document warns and keeps working in memory. Copy feedback before leaving that session.

Stored text comments include anchor IDs, offsets, and the quoted excerpt. On restoration, the runtime resolves the location and reports orphaned feedback rather than confidently highlighting unrelated text. Rewording the document can therefore make an old comment need review.

## Programmatic parsing

The serializer and parser live in `src/bucket/serialize.ts` and are covered by the golden fixture in `tests/golden/bucket-v1.txt`. They are internal modules in this release, not named exports from the npm package entry point. Do not assume `import { parseBucket } from 'forgedoc'` exists.

Use the [runtime API](/docs/runtime-api/) for the public browser surface. An integration that needs a machine-readable bucket parser should account for this current export boundary explicitly.
