# Reading the reader's answers

The reader sends you a block that starts with `=== FB v1 ·`. It carries the
question text and the chosen labels word for word, so you can read it without
the original file.

```text
=== FB v1 · vendor-orders · 2026-07-28T10:22:31Z · 2 items ===

[1] ANSWER q-should-read-state-be-shared
q: Should read state be shared across the vendor team?
a: Yes — shared team inbox
n: only if we can still see who marked it read

[2] COMMENT sec-what-we-are-building
at: 1 What we are building
> Vendors get told the moment a new order lands
c: is this the payment webhook or the order row?

=== end FB v1 ===
```

## The fields

| Field | What it holds |
| --- | --- |
| `q:` | the question that was asked |
| `a:` | a chosen label — repeated once per choice on a multi-answer |
| `n:` | a note the reader wrote about their answer |
| `>` | the text they selected |
| `c:` | their comment on that text |
| `at:` | where in the document it happened |

A field that runs long continues on lines indented by exactly three spaces.

A comment on a diagram, an image or a code block has no selectable text, so its
`>` line describes the block instead:

```text
> doc-figure · How a plan travels from the agent to the reader and back
```

Match those by the caption or filename in the description, because the id is
generated.

## Rules for matching an item to the document

Apply these exactly.

1. Match each item by its anchor id first — the token right after `ANSWER` or
   `COMMENT` — and by the quoted text second.
2. Treat the option label as the truth, not the letter. If the label and the
   letter disagree, or the anchor is no longer in your copy, ask the reader which
   option they meant.
3. Attach an answer only to a question whose text matches word for word. If the
   wording changed between their copy and yours, ask rather than assume.
4. If one item is malformed, process every other item and tell the reader which
   one you could not read.
5. An `a:` line under an Other answer is the reader's own wording. Treat it as a
   new proposal, not as one of your options.

## What to do with what they said

Fold the decisions into the same file and build it again. The document is one
file for its whole life, so a revision overwrites it — never write a copy, a
second file, or a version number into the name.

A settled question becomes a statement in the prose: what was chosen, and why.
Then delete the `doc-choice` that asked it. A decision the reader has already
made should not be put to them twice, and a plan that still asks it reads as if
nobody listened.

A comment usually means one of three things, and they need different answers:

- **A question about the plan** — answer it in the prose, where the next reader
  will find it too.
- **A correction** — make the change, and say in the reply which paragraph moved.
- **A disagreement about an approach** — this is a decision that was not open
  when you wrote it. Add the `doc-choice` you should have asked, with their
  position as a real option.

When you hand the revised document back, say what changed and what is still
open. The reader needs to know whether their comment landed without reading the
whole plan again.
