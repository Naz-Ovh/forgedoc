/**
 * The namespaced persistent store.
 *
 * MUST (§9.1): `doc-page` owns a single instance. Components never reach for
 * `localStorage` themselves — one read on mount, one debounced write on change.
 *
 * MUST (§9.3): every key is namespaced with `doc-id`, and unavailable storage
 * is detected with a real write/read/delete probe. Silent data loss on a
 * feedback tool is the worst possible failure mode; everything degrades loudly.
 */

import { type DocState, type DocStore, emptyState } from './types.js';

/** Debounce window for writes. Long enough to coalesce typing, short enough to survive a tab close. */
const WRITE_DEBOUNCE_MS = 250;

/** One store per `doc-page` element, created on first request. */
const storesByDocument = new WeakMap<Element, DocStore>();

/**
 * Get (or lazily create) the store for a `doc-page`.
 *
 * why a WeakMap rather than a field on the element: components ask for the store
 * during their own `enhance()`, and there is no guarantee `doc-page` upgraded
 * first. Keying off the element removes the ordering dependency entirely.
 */
export function storeFor(docPage: Element): DocStore {
  const existing = storesByDocument.get(docPage);
  if (existing) return existing;

  const docId = docPage.getAttribute('doc-id')?.trim() || 'unnamed-plan';
  const store = createStore(docId);
  storesByDocument.set(docPage, store);
  return store;
}

/** The `localStorage` key for a plan: `forgedoc:<doc-id>:state`. */
export function storageKey(docId: string): string {
  return `forgedoc:${docId}:state`;
}

/**
 * Probe storage for real.
 *
 * why (§9.3): a `typeof localStorage` check passes in Safari private mode and
 * then throws on the first write. The only reliable test is to write, read back,
 * and delete.
 */
export function probeStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;

    const probeKey = '__forgedoc_probe__';
    storage.setItem(probeKey, '1');
    const readBack = storage.getItem(probeKey);
    storage.removeItem(probeKey);
    return readBack === '1' ? storage : null;
  } catch {
    return null;
  }
}

/** Build a store for one plan id. Exported for tests; components use `storeFor`. */
export function createStore(docId: string): DocStore {
  const storage = probeStorage();
  const key = storageKey(docId);
  const subscribers = new Set<(state: DocState) => void>();

  let state = readState(storage, key, docId);
  let writeTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = (): void => {
    writeTimer = undefined;
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch {
      // Quota or a mid-session permission change. The banner in doc-page already
      // warns when storage was unavailable at mount; there is nothing further to
      // do here except keep the in-memory state working.
    }
  };

  const scheduleWrite = (): void => {
    if (writeTimer !== undefined) clearTimeout(writeTimer);
    writeTimer = setTimeout(flush, WRITE_DEBOUNCE_MS);
  };

  const notify = (): void => {
    for (const subscriber of subscribers) subscriber(state);
  };

  // why: a debounced write loses the last 250ms of typing if the reader closes
  // the tab mid-sentence. `pagehide` is the one lifecycle event that fires
  // reliably on both desktop and mobile, including bfcache eviction.
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('pagehide', () => {
      if (writeTimer !== undefined) {
        clearTimeout(writeTimer);
        flush();
      }
    });
  }

  return {
    available: storage !== null,

    get<K extends keyof DocState>(stateKey: K): DocState[K] {
      return state[stateKey];
    },

    set<K extends keyof DocState>(stateKey: K, value: DocState[K]): void {
      state = { ...state, [stateKey]: value };
      scheduleWrite();
      notify();
    },

    subscribe(fn: (next: DocState) => void): () => void {
      subscribers.add(fn);
      // Svelte's store contract requires calling the subscriber immediately.
      fn(state);
      return () => {
        subscribers.delete(fn);
      };
    },

    clear(): void {
      state = emptyState(docId);
      try {
        storage?.removeItem(key);
      } catch {
        // Nothing useful to do; the in-memory reset above already took effect.
      }
      notify();
    },
  };
}

/** Read and migrate persisted state, falling back to a fresh blob on any problem. */
function readState(storage: Storage | null, key: string, docId: string): DocState {
  if (!storage) return emptyState(docId);

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return emptyState(docId);
  }
  if (!raw) return emptyState(docId);

  try {
    const parsed = JSON.parse(raw) as Partial<DocState>;
    return migrate(parsed, docId);
  } catch {
    // Corrupt JSON. Starting clean beats throwing during mount.
    return emptyState(docId);
  }
}

/**
 * Fold a persisted blob onto the current shape.
 *
 * why: a plan document lives for months and gets reopened after the library has
 * moved on. Merging field by field means a blob written by an older version
 * still yields the reader's answers and feedback instead of an empty document.
 */
function migrate(parsed: Partial<DocState>, docId: string): DocState {
  const fresh = emptyState(docId);
  return {
    version: 1,
    docId,
    answers: isRecord(parsed.answers) ? parsed.answers : fresh.answers,
    feedback: Array.isArray(parsed.feedback) ? parsed.feedback : fresh.feedback,
    collapse: isRecord(parsed.collapse) ? parsed.collapse : fresh.collapse,
    tabs: isRecord(parsed.tabs) ? parsed.tabs : fresh.tabs,
    checks: isRecord(parsed.checks) ? parsed.checks : fresh.checks,
    toc: migrateToc(parsed.toc, fresh.toc),
    // Added after the first release, so a blob written before it says nothing
    // about it. `undefined` must read as the default rather than as `false` —
    // reopening an old document with the composer silently disabled would look
    // exactly like the bug this preference exists to fix.
    selectionPopup:
      typeof parsed.selectionPopup === 'boolean' ? parsed.selectionPopup : fresh.selectionPopup,
  };
}

/**
 * Fold a persisted TOC preference onto the current shape.
 *
 * why field by field rather than a shape check: `docked` was added after the
 * first release, and a blob written before it exists is `{ open: true }`. Taking
 * that object wholesale would leave `docked` undefined, which reads as false
 * everywhere except `typeof` checks — so it is filled from the fresh default.
 */
function migrateToc(parsed: DocState['toc'] | undefined, fresh: DocState['toc']): DocState['toc'] {
  if (!isRecord(parsed)) return fresh;
  return {
    open: typeof parsed.open === 'boolean' ? parsed.open : fresh.open,
    docked: typeof parsed.docked === 'boolean' ? parsed.docked : fresh.docked,
  };
}

/** True for a plain object — not null, not an array. Narrows away `undefined`. */
function isRecord<T>(value: T | undefined): value is T {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
