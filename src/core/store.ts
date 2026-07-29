/**
 * The namespaced persistent store.
 *
 * MUST (§9.1): `plan-doc` owns a single instance. Components never reach for
 * `localStorage` themselves — one read on mount, one debounced write on change.
 *
 * MUST (§9.3): every key is namespaced with `plan-id`, and unavailable storage
 * is detected with a real write/read/delete probe. Silent data loss on a
 * feedback tool is the worst possible failure mode; everything degrades loudly.
 */

import { emptyState, type PlanState, type PlanStore } from './types.js';

/** Debounce window for writes. Long enough to coalesce typing, short enough to survive a tab close. */
const WRITE_DEBOUNCE_MS = 250;

/** One store per `plan-doc` element, created on first request. */
const storesByDocument = new WeakMap<Element, PlanStore>();

/**
 * Get (or lazily create) the store for a `plan-doc`.
 *
 * why a WeakMap rather than a field on the element: components ask for the store
 * during their own `enhance()`, and there is no guarantee `plan-doc` upgraded
 * first. Keying off the element removes the ordering dependency entirely.
 */
export function storeFor(planDoc: Element): PlanStore {
  const existing = storesByDocument.get(planDoc);
  if (existing) return existing;

  const planId = planDoc.getAttribute('plan-id')?.trim() || 'unnamed-plan';
  const store = createStore(planId);
  storesByDocument.set(planDoc, store);
  return store;
}

/** The `localStorage` key for a plan: `plankit:<plan-id>:state`. */
export function storageKey(planId: string): string {
  return `plankit:${planId}:state`;
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

    const probeKey = '__plankit_probe__';
    storage.setItem(probeKey, '1');
    const readBack = storage.getItem(probeKey);
    storage.removeItem(probeKey);
    return readBack === '1' ? storage : null;
  } catch {
    return null;
  }
}

/** Build a store for one plan id. Exported for tests; components use `storeFor`. */
export function createStore(planId: string): PlanStore {
  const storage = probeStorage();
  const key = storageKey(planId);
  const subscribers = new Set<(state: PlanState) => void>();

  let state = readState(storage, key, planId);
  let writeTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = (): void => {
    writeTimer = undefined;
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch {
      // Quota or a mid-session permission change. The banner in plan-doc already
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

    get<K extends keyof PlanState>(stateKey: K): PlanState[K] {
      return state[stateKey];
    },

    set<K extends keyof PlanState>(stateKey: K, value: PlanState[K]): void {
      state = { ...state, [stateKey]: value };
      scheduleWrite();
      notify();
    },

    subscribe(fn: (next: PlanState) => void): () => void {
      subscribers.add(fn);
      // Svelte's store contract requires calling the subscriber immediately.
      fn(state);
      return () => {
        subscribers.delete(fn);
      };
    },

    clear(): void {
      state = emptyState(planId);
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
function readState(storage: Storage | null, key: string, planId: string): PlanState {
  if (!storage) return emptyState(planId);

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return emptyState(planId);
  }
  if (!raw) return emptyState(planId);

  try {
    const parsed = JSON.parse(raw) as Partial<PlanState>;
    return migrate(parsed, planId);
  } catch {
    // Corrupt JSON. Starting clean beats throwing during mount.
    return emptyState(planId);
  }
}

/**
 * Fold a persisted blob onto the current shape.
 *
 * why: a plan document lives for months and gets reopened after the library has
 * moved on. Merging field by field means a blob written by an older version
 * still yields the reader's answers and feedback instead of an empty document.
 */
function migrate(parsed: Partial<PlanState>, planId: string): PlanState {
  const fresh = emptyState(planId);
  return {
    version: 1,
    planId,
    answers: isRecord(parsed.answers) ? parsed.answers : fresh.answers,
    feedback: Array.isArray(parsed.feedback) ? parsed.feedback : fresh.feedback,
    collapse: isRecord(parsed.collapse) ? parsed.collapse : fresh.collapse,
    tabs: isRecord(parsed.tabs) ? parsed.tabs : fresh.tabs,
    checks: isRecord(parsed.checks) ? parsed.checks : fresh.checks,
    toc: migrateToc(parsed.toc, fresh.toc),
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
function migrateToc(
  parsed: PlanState['toc'] | undefined,
  fresh: PlanState['toc'],
): PlanState['toc'] {
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
