---
title: JavaScript API
description: The actual package exports, the ForgeDoc browser global, and the document store.
---

Most authored documents need no JavaScript. Use this API when browser tooling needs to inspect a document, read its state, or add a chip after a decision.

## Package entry point

The runtime entry point exports five names:

| Export | Purpose |
| --- | --- |
| `defineAll()` | Register every element; safe to call repeatedly |
| `version` | The package version embedded at build time |
| `vocabulary` | Readonly list of known tag names |
| `chips` | A small API for appending runtime chips |
| `store()` | Get the document's namespaced store |

Importing the module also calls `defineAll()`. It is a browser runtime: importing it requires DOM APIs such as `HTMLElement` and custom elements. Do not import it into a Node-only validation process or a server-rendered module.

```js
import { chips, store, version, vocabulary } from 'forgedoc';
import 'forgedoc/style.css';

console.log(version, vocabulary.length);
const documentStore = store(document.querySelector('doc-page'));
```

Run browser integration code after the document markup exists. Loading a runtime in the middle of HTML parsing can enhance elements before their children have arrived.

## Browser global

An IIFE build exposes the same namespace as `window.ForgeDoc`:

```js
const currentVersion = window.ForgeDoc.version;
const documentStore = window.ForgeDoc.store();

window.ForgeDoc.chips.add({
  kind: 'confirmed',
  text: 'Shared inbox selected',
});
```

These calls belong in integration tooling after the runtime loads. They are not instructions to add arbitrary scripts to an agent-authored document.

## `defineAll(): void`

Registers all runtime elements. The registry guards against duplicate definitions. Use it if an integration explicitly needs to request registration again; ordinary imports already register everything.

## `chips.add(chip, docPage?)`

```ts
chip: { kind: string; text: string }
docPage?: Element
// Returns HTMLElement | null
```

The function finds a `doc-chips` row inside the supplied page, or inside the first `doc-page`. It delegates to that row's runtime method and returns the new element. It returns `null` when no page or suitable chip row exists.

Use a supported [chip kind](/docs/reference/doc-chip/) even though this integration signature accepts a string. This helper appends runtime UI; it does not rewrite the HTML source on disk.

## `store(docPage?): DocStore | null`

Returns the store for the supplied page, or for the first `doc-page`. With no page, it returns `null`. There is one store per page element, keyed by the page's `doc-id`.

```js
const documentStore = window.ForgeDoc.store();
if (documentStore) {
  const stop = documentStore.subscribe((state) => {
    console.log(state.answers, state.feedback);
  });

  // Call stop() when this integration no longer needs updates.
}
```

| Store member | Behavior |
| --- | --- |
| `available` | Whether local storage passed the initial probe |
| `get(key)` | Read a field from the current state |
| `set(key, value)` | Replace that field, schedule persistence, and notify subscribers |
| `subscribe(fn)` | Call immediately, then on updates; return an unsubscribe function |
| `clear()` | Reset in-memory state and remove the persisted blob |

Do not call `clear()` as a routine initialization step: it removes the reader's answers and comments.

## State fields

| Field | Shape |
| --- | --- |
| `version` | `1` — the state schema version |
| `docId` | Document slug |
| `answers` | Anchor ID → selected keys, optional Other text, optional note |
| `feedback` | Comments with identity, timestamp, location, and serialized range |
| `collapse` | Anchor ID → boolean |
| `tabs` | Anchor ID → selected tab index |
| `checks` | Checklist key → boolean |
| `toc` | `{ open: boolean, docked: boolean }` |
| `selectionPopup` | Whether text selection opens the comment composer |

Persistence writes are debounced by 250 ms and flushed on `pagehide`. Subscription callbacks receive the full current state immediately. Mutate through `set()` so persistence and subscribers see the change; do not modify returned objects in place.

## Export boundaries

`TAGS`, `DocElement`, `parseBucket`, and `serializeBucket` are internal source modules, not named package exports in the current entry point. The package does not provide a general server-side HTML renderer or a public Node validation export. Use the CLI for validation and generation.

Package paths include `forgedoc/style.css` and `forgedoc/standalone`. The latter points to the standalone IIFE artifact; it is not a separate Node-safe module.

See [architecture](/docs/architecture/) for the shared contract and [feedback](/docs/feedback/) for the wire format.
