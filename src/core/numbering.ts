/**
 * Section, stage and option sequencing.
 *
 * The agent never types a number, a letter or a section id (§1.2). Everything
 * here is derived at mount so that inserting a section in the middle of a plan
 * cannot leave a stale "see Stage 5" behind.
 */

import {
  collapseId,
  type IdCandidate,
  questionId,
  resolveIds,
  sectionId,
  slugify,
  stageId,
} from './slug.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Option key for a zero-based index: `A`, `B`, … `Z`, `AA`, `AB`.
 *
 * why letters rather than numbers: a reader answering by voice or in a pasted
 * bucket says "B", and `B` cannot be confused with a section number.
 */
export function letterKey(index: number): string {
  if (index < 0) throw new RangeError(`letterKey: index must be >= 0, got ${index}`);

  let remaining = index;
  let key = '';
  do {
    key = `${LETTERS[remaining % 26] ?? '?'}${key}`;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return key;
}

/**
 * The key reserved for the always-appended "Other" option (§8.4).
 *
 * why a fixed key rather than the next letter: `O` stays `O` when the author
 * adds a fifth option, so a bucket collected against an earlier draft still
 * means the same thing.
 */
export const OTHER_KEY = 'O';

/** Letter keys for `count` author options, skipping the one reserved for Other. */
export function optionKeys(count: number): string[] {
  const keys: string[] = [];
  for (let index = 0; keys.length < count; index += 1) {
    const key = letterKey(index);
    if (key === OTHER_KEY) continue;
    keys.push(key);
  }
  return keys;
}

/**
 * Dotted section number from an ancestor path of zero-based indices.
 * `[0]` → `1`, `[1, 0]` → `2.1`, `[0, 2, 1]` → `1.3.2`.
 */
export function sectionNumber(path: readonly number[]): string {
  return path.map((index) => index + 1).join('.');
}

/**
 * Stage numbers for a roadmap.
 *
 * MUST (§8.5): numbering starts at 0 by default, matching the reference where
 * Stage 0 is the next deliverable.
 */
export function stageNumbers(count: number, start = 0): number[] {
  return Array.from({ length: count }, (_, index) => start + index);
}

// ─────────────────────────────────────────────────────────────────────────────
// Document index
// ─────────────────────────────────────────────────────────────────────────────

/** One entry in the section outline, in document order. */
export interface OutlineEntry {
  readonly element: HTMLElement;
  readonly id: string;
  /** 1-based nesting depth. The vocabulary supports 3. */
  readonly depth: number;
  /** Dotted number, e.g. `1.2.1`. */
  readonly number: string;
  readonly title: string;
}

/** Everything the runtime derives once per document and every component reads. */
export interface DocumentIndex {
  readonly outline: readonly OutlineEntry[];
  /** Resolved id for every id-bearing element, keyed by the element itself. */
  readonly ids: ReadonlyMap<Element, string>;
}

/** Tags that take part in the document id namespace. Mirrors the validator. */
const ID_BEARING_SELECTOR = 'plan-section, plan-choice, plan-stage, plan-collapse';

const indexes = new WeakMap<Element, DocumentIndex>();

/**
 * Build (or return the cached) index for a `plan-doc`.
 *
 * why lazily and cached rather than eagerly in `plan-doc.enhance()`: components
 * upgrade in whatever order `index.ts` happens to define them, and a
 * `plan-section` that upgraded first still needs its number. Whoever asks first
 * pays for the walk; everyone else gets the same object.
 */
export function indexFor(planDoc: Element): DocumentIndex {
  const cached = indexes.get(planDoc);
  if (cached) return cached;

  const built = buildIndex(planDoc);
  indexes.set(planDoc, built);
  return built;
}

/** Drop the cached index. Used by tests and by tooling that rewrites the DOM. */
export function invalidateIndex(planDoc: Element): void {
  indexes.delete(planDoc);
}

function buildIndex(planDoc: Element): DocumentIndex {
  const elements = Array.from(planDoc.querySelectorAll<HTMLElement>(ID_BEARING_SELECTOR));

  const candidates: IdCandidate[] = elements.map((element) => ({
    explicitId: element.getAttribute('id'),
    derivedId: derivedIdFor(element),
  }));
  const resolved = resolveIds(candidates);

  const ids = new Map<Element, string>();
  elements.forEach((element, position) => {
    const id = resolved[position];
    if (id) ids.set(element, id);
  });

  return { outline: buildOutline(planDoc, ids), ids };
}

/** The id the runtime derives for one element. Mirrors `tools/validate.ts`. */
function derivedIdFor(element: HTMLElement): string {
  const title = element.getAttribute('title')?.trim() ?? '';

  switch (element.tagName.toLowerCase()) {
    case 'plan-section':
      return sectionId(title);
    case 'plan-choice':
      return questionId(element.getAttribute('question')?.trim() ?? '');
    case 'plan-stage':
      return stageId(title);
    case 'plan-collapse':
      return collapseId(title);
    default:
      return slugify(title);
  }
}

/**
 * Walk the section tree in document order, assigning depths and dotted numbers.
 *
 * The counter array holds the running number at each depth. Descending a level
 * pushes a zero; returning to a shallower level truncates, which is what resets
 * `1.2.1` back to `2` when the next top-level section starts.
 */
function buildOutline(planDoc: Element, ids: ReadonlyMap<Element, string>): OutlineEntry[] {
  const sections = Array.from(planDoc.querySelectorAll<HTMLElement>('plan-section'));
  const counters: number[] = [];
  const outline: OutlineEntry[] = [];

  for (const element of sections) {
    const depth = sectionDepth(element, planDoc);

    counters.length = depth;
    counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;
    for (let level = 0; level < depth; level += 1) {
      if (counters[level] === undefined) counters[level] = 1;
    }

    outline.push({
      element,
      id: ids.get(element) ?? sectionId(element.getAttribute('title') ?? ''),
      depth,
      number: counters.slice(0, depth).join('.'),
      title: element.getAttribute('title')?.trim() ?? '',
    });
  }

  return outline;
}

/** 1-based nesting depth of a section within its document. */
function sectionDepth(element: HTMLElement, planDoc: Element): number {
  let depth = 1;
  let ancestor = element.parentElement;
  while (ancestor && ancestor !== planDoc) {
    if (ancestor.tagName.toLowerCase() === 'plan-section') depth += 1;
    ancestor = ancestor.parentElement;
  }
  return depth;
}

/** Sequence counter for document-wide numbering, e.g. blockers and questions. */
export class Sequence {
  #next: number;

  constructor(start = 1) {
    this.#next = start;
  }

  take(): number {
    const value = this.#next;
    this.#next += 1;
    return value;
  }
}
