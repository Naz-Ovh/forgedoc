/**
 * Types shared across more than two modules.
 *
 * §12: types live in the file that owns them; only genuinely shared ones land
 * here. Everything in this file is read by the store, the bucket and at least
 * one component.
 */

/** A reader's answer to one `doc-choice`. */
export interface StoredAnswer {
  /** Selected option keys — letters `A`, `B`, `O`… or an author `value` override. */
  keys: string[];
  /** Free text typed into the always-appended "Other" option. */
  otherText?: string;
  /** A comment *on the answer*, not a second answer. */
  note?: string;
}

/**
 * A range serialised to something that survives a reload.
 *
 * why (§10.2): a live `Range` is meaningless after navigation, and text offsets
 * alone break the moment a component appends chrome. The anchor id plus a quoted
 * excerpt gives two independent ways to find the text again.
 */
export interface SerializedRange {
  /** Id of the nearest `doc-*` ancestor that has one. */
  anchorId: string;
  /** Character offset into the anchor's `textContent`. */
  start: number;
  end: number;
  /** The selected text itself, used as the fallback locator. */
  quote: string;
}

/** One reader comment attached to a selection. */
export interface FeedbackItem {
  id: string;
  /** ISO 8601, seconds precision. Serialised verbatim so the wire format round-trips. */
  createdAt: string;
  range: SerializedRange;
  comment: string;
  /** Human-readable location, e.g. `3.1 Data model`. Empty when unknown. */
  at: string;
  /**
   * `text` — the default — anchors to a character range inside the anchor.
   * `block` anchors to the whole element instead.
   *
   * why the distinction exists: a diagram, an image or a Mermaid chart has no
   * text to select, so the only way to comment on one is to name the element.
   * Optional, so a blob written before block comments existed still loads.
   */
  scope?: 'text' | 'block';
}

/**
 * The whole persisted document state — one blob, one key (§9.1).
 *
 * `answers` and `feedback` MUST survive a reload and are never dropped unless
 * the reader explicitly removes or clears them. `collapse`, `tabs` and `checks`
 * are convenience; losing them is acceptable.
 */
export interface DocState {
  version: 1;
  docId: string;
  answers: Record<string, StoredAnswer>;
  feedback: FeedbackItem[];
  collapse: Record<string, boolean>;
  tabs: Record<string, number>;
  checks: Record<string, boolean>;
  /**
   * `open` — the entry list is showing. `docked` — the panel is pinned to the
   * side and pushes the reading column across instead of floating over it.
   * Docking implies open; see `DocPage#setToc`.
   */
  toc: { open: boolean; docked: boolean };
  /**
   * Whether selecting text pops the comment composer open.
   *
   * why this is a preference and not a constant: the composer is the right
   * default — a reader who has never met the document will not go looking for a
   * commenting affordance — but it fires on *every* selection, and selecting
   * text is also how people read closely, quote into a chat, or look a phrase
   * up. Once someone is reading rather than reviewing, the popover is in the
   * way, and there was no way to put it away.
   *
   * Off does not mean silent: the block `Comment` buttons and the bucket panel
   * keep working, so this narrows the affordance rather than removing it.
   */
  selectionPopup: boolean;
}

/** A fresh, empty state for `docId`. */
export function emptyState(docId: string): DocState {
  return {
    version: 1,
    docId,
    answers: {},
    feedback: [],
    collapse: {},
    tabs: {},
    checks: {},
    // MUST (§8.1 as amended): the contents panel starts floating and collapsed.
    // A rail that opens itself covers the first screen of the document, which is
    // the one screen the reader actually asked for.
    toc: { open: false, docked: false },
    // Default on: discoverability beats tidiness for a first-time reader, and
    // one ⌘/Ctrl+K puts it away for good.
    selectionPopup: true,
  };
}

/**
 * The store contract (§9.2).
 *
 * `subscribe` returns an unsubscribe function, which is exactly Svelte's store
 * contract — so the bucket panel can use `$store` syntax with zero glue while
 * the vanilla components subscribe directly.
 */
export interface DocStore {
  get<K extends keyof DocState>(key: K): DocState[K];
  set<K extends keyof DocState>(key: K, value: DocState[K]): void;
  subscribe(fn: (state: DocState) => void): () => void;
  /** False when storage is blocked — Safari private mode, some `file://` origins. */
  readonly available: boolean;
  /** Discard everything for this plan id. */
  clear(): void;
}
