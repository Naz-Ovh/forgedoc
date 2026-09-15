---
name: better-plan
description: Write a planning document as ForgeDoc markup — a readable HTML page the reader can answer inside — and build it to one self-contained file. Use when asked to plan work, propose an approach, write a design doc or an RFC, revise a plan, or collect decisions from a human reviewer.
---

# Better plans with ForgeDoc

## What a plan is

A plan is writing. It explains the problem, says what you propose, and asks the
reader what you cannot decide alone. Sentences do almost all of that.

ForgeDoc delivers the writing as a styled HTML page the reader can answer inside.
Its `doc-*` tags — **elements** — cover the few things sentences carry badly. The
runtime supplies design, layout, dark mode, numbering, anchors and the feedback
box the reader pastes back to you. You supply the meaning.

Think, write it in words, and place an element only where words fall short.

## Words first

Write like a memo to a colleague: what is true now, what you propose, what it
costs, what you are unsure about. Plain HTML carries this — `<p>`, `<ul>`,
`<li>`, `<code>`, `<a>`, `<strong>`. It is already styled, so no element exists
for it.

Reach for an element when you are about to:

- ask the reader to decide — `doc-choice`, the thing that makes a plan answerable
- draw a shape in words, or describe how parts connect
- lay out an order of work, dates, or steps with a state
- compare options side by side, or show numbers
- show code, or a change to a file
- say something is stuck, and what unsticks it

Use the element instead of building it from `<div>`s: shorter to write, far fewer
output tokens, identical in every plan, and the reader's feedback tools know what
it is. Hand-built markup gives up all four.

## Look the vocabulary up

`CHEATSHEET.md` beside this file is the whole vocabulary on one page. Read it
before writing markup. When it leaves a question open:

```sh
npx forgedoc search <words>    # which element does X?
npx forgedoc info doc-choice   # attributes, rules and an example for one element
```

An invented tag or a guessed attribute fails the build.

## Elements go where the content is

A question goes right after the paragraph that raises the doubt — not in a list
at the end. A diagram goes where you would otherwise say "picture this". A
blocker goes inside the section it blocks.

No required order, no required sections, no place a question has to live. Two
plans about two problems should not look alike. Let the shape follow the problem.

```html
<doc-section title="Where the notification comes from">
  <p>
    An order row is written before payment settles, so a notification sent on
    insert can reach a vendor for an order that never completes. The payment
    webhook is the first moment the order is real.
  </p>

  <doc-choice mode="single" question="Send on the payment webhook, or on order insert?">
    <doc-option recommended>
      On the payment webhook
      <p slot="desc">No false alerts. Costs about two seconds of delay.</p>
    </doc-option>
    <doc-option>
      On order insert
      <p slot="desc">Instant, but vendors see orders that may never pay.</p>
    </doc-option>
  </doc-choice>

  <p>Either way the send is queued, so a slow vendor cannot hold up checkout.</p>
</doc-section>
```

The question sits mid-section because that is where the doubt appears. Copy the
habit, not the shape.

## Questions

Ask when the answer changes the work. Mark your suggestion `recommended`, and
give each option its real cost in one line. Decisions already made belong in the
prose as statements, with the reasoning behind them.

You never need a question to invite feedback — the reader can select any sentence
and comment on it. One more reason most of a plan should be prose.

## The file

Name it `PLAN_<name>.html`, or `DOC_<name>.html` for documentation. Two lines are
required byte for byte: the style in `<head>`, the script last in `<body>`.

```html
<style>/*@DOC_CSS@*/</style>
<script>//@DOC_JS@</script>
```

Everything else sits inside one `<doc-page doc-id="a-unique-slug">`. The `doc-id`
is required — it is the key the reader's answers are stored under.

```sh
npx forgedoc build PLAN_<name>.html
```

**The build rewrites that same file.** One document, one file, for its whole
life. To revise, edit it and build again: the build reads its own output. Never
write a copy, a second file, or a version number into the name — the reader's
link keeps working because the document never moves.

Titles, questions and sections produce their own headings, numbers, anchors,
option letters and contents entries, so none of those are yours to type. Themes,
offline delivery and keeping past versions are in `BUILDING.md`.

## Before you hand it over

1. Read only the sentences, ignoring every element. The plan should still explain
   itself. If not, the thinking went into furniture — put it back in the text.
2. For each element, say in one sentence what a paragraph could not have done
   there. No answer means delete it and write the paragraph.

Spend your output tokens on sentences. The runtime owns the design; thinking is
the expensive part.

## When the reader answers

They send a block starting `=== FB v1 ·`. Read `FEEDBACK.md` beside this file
before interpreting it.
