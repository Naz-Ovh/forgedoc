---
title: Planning documents
description: Make the proposed work concrete, explain trade-offs, and ask questions the reader can actually resolve.
---

A good plan tells the reader what will change, why it matters, how it will be implemented, and which choices are still open. ForgeDoc makes those choices answerable, but the quality of the decision still depends on the writing.

## Start with the outcome

In the header and first section, describe the behavior the user will experience. Name the trigger and result. “Improve order handling” is vague; “When an order arrives, every vendor teammate sees it in one shared inbox” can be reviewed.

Use a stable `PLAN_<name>.html` filename for an agent-authored plan, with the [document shell](/docs/authoring/). `forgedoc new <name>` uses the generic `DOC_` prefix; choose the `PLAN_` prefix when naming the plan yourself.

## Show the implementation where it helps

Use sections for architecture, data flow, failure cases, verification, and rollout. Include only the diagram or code that helps assess a decision. Use `doc-compare` when side-by-side alternatives are clearer than prose, and `doc-roadmap` when the work has meaningful stages.

The exact structure is in the [component reference](/docs/reference/). Do not invent attribute names such as `label` when an element expects `title`.

## Turn uncertainty into a question

```html
<doc-choice mode="single" question="Should read state be shared across the team?">
  <doc-option recommended>
    Shared read state
    <p>Everyone sees the same queue, with fewer duplicate actions.</p>
  </doc-option>
  <doc-option>
    Per-person read state
    <p>Each teammate can track what they personally reviewed.</p>
  </doc-option>
</doc-choice>
```

Explain the recommendation and the cost of each option. Keep question wording stable after handoff, because feedback matching checks the original question text.

The runtime appends an Other option. Do not hand-author a substitute or assign A/B letters; those are derived.

## Close settled decisions

After receiving feedback, replace an answered question with prose that states the decision and its reason. Keep any remaining uncertainty explicit. Rebuild the same file; do not send a second filename that invites the reader to comment on the wrong copy.

See [feedback matching and revisions](/docs/feedback/) for the exact rules.

## Verify the handoff

Run `forgedoc build PLAN_<name>.html`. Read the built document from top to bottom. Confirm every open question has enough context to choose, every code example uses a supported language, and the chosen delivery mode works for the reader.

If build fails, correct its diagnostics. If the reader needs prior versions, use [history mode](/docs/guides/delivery/#keep-a-history) instead of introducing version suffixes into filenames.
