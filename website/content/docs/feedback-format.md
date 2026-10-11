---
title: Feedback format (FB v1)
description: The wire-format contract for sending collected answers and comments back to an AI author.
---

`FB v1` is ForgeDoc's plain-text feedback format. It packages the reader's
answers and comments with enough context for the author to interpret them
outside the browser. The collector writes it; the reader copies it into an
agent conversation.

For the reading and revision workflow, start with [the feedback collector](/docs/feedback/).
This page describes the format itself.

## Complete example

```text
=== FB v1 · vendor-orders · 2026-07-28T10:22:31Z · 2 items ===

[1] ANSWER q-should-read-state-be-shared
q: Should read state be shared across the vendor team?
a: Shared team inbox
n: only if we can still see who marked it read

[2] COMMENT sec-the-approach
at: 1 The approach
> Every order has one owner
c: Can we support two owners during a handover?

=== end FB v1 ===
```

## Envelope

The header contains the document ID, an ISO 8601 timestamp, and the item count,
separated by ` · `. The footer is exactly `=== end FB v1 ===`.
The serializer uses seconds precision for the timestamp. The parser preserves
the received timestamp instead of replacing it with the parse time.

```text
=== FB v1 · <doc-id> · <timestamp> · <count> items ===
```

The parser accepts the singular `item` as well as `items`. A document ID identifies
the document, not the person who reviewed it or an AI provider.

## Answer items

```text
[1] ANSWER q-should-read-state-be-shared
q: Should read state be shared?
a: Shared team inbox
n: Show who last changed the read state
```

| Field | Contract |
| --- | --- |
| `[1]` | The serialized item number |
| `ANSWER` | The item kind |
| Anchor after `ANSWER` | The question's derived or authored anchor ID |
| `q:` | Original question text, preserved verbatim |
| `a:` | Selected option label, preserved verbatim |
| `n:` | Optional note; omitted when empty |

For a multi-answer question, repeat `a:` once per selected label in document
order. An Other answer serializes the reader's own words as an answer label.
Option letters are not the decision's durable meaning; the labels are.

## Comment items

```text
[2] COMMENT sec-the-approach
at: 1 The approach
> Every order has one owner
c: Can two people share ownership during a handover?
```

| Field | Contract |
| --- | --- |
| `COMMENT` | The item kind |
| Anchor after `COMMENT` | The nearest relevant `doc-*` anchor |
| `at:` | Human-readable location; may be omitted when unknown |
| `>` | The selected quotation or block descriptor |
| `c:` | The reader's comment |

The wire format carries a quotation and anchor, not a browser `Range` or a DOM
snapshot. The document's persisted state keeps richer range information for
local restoration; those storage fields are separate from this text format.

## Blocks without selectable text

```text
[3] COMMENT fig-order-flow
at: 2 Architecture
> doc-figure · How an order reaches the inbox
c: Show where a failed webhook is retried
```

A diagram or image may have no useful text selection. A block comment uses the
element's descriptor instead. Match it by anchor first, then caption or filename,
rather than treating the descriptor as a quotation from the prose.

## Multiline fields

Continuation lines start with exactly three spaces:

```text
c: Keep the shared inbox.
   Also show an audit trail for read-state changes.
```

The continuation becomes part of the preceding field. Retain that indentation
when copying or programmatically producing a bucket; ordinary wrapping that
removes it can alter what the parser receives.

## Matching and error handling

Match an anchor first and quoted content second. Apply an answer only to the
question whose wording matches the `q:` field. If the question has changed,
ask the reader to confirm instead of inferring intent.

The internal parser returns a document and a list of problems. A malformed item
does not discard every valid item. A missing or invalid envelope may prevent
reconstructing a document at all. Report unresolved items rather than silently
dropping feedback.

## Implementation and compatibility

The implementation is in `src/bucket/serialize.ts`. The compatibility specimen is
`tests/golden/bucket-v1.txt`; tests check a byte-for-byte parse/serialize round trip.
Preserve that compatibility when changing the collector.

The current package entry point does not expose `parseBucket` or `serializeBucket`
as public named exports. Read [the JavaScript API](/docs/runtime-api/) before
building an integration around internal functions.
