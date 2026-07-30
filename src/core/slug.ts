/**
 * Heading text → stable, human-readable id.
 *
 * why (§8.1): ids are *derived*, never authored. That buys anchor stability for
 * free — if a section's meaning changes its title changes, so its id changes; if
 * the title is untouched the id survives a regeneration byte for byte. Both the
 * browser runtime and the Node validator import this file, so it MUST stay free
 * of any DOM reference (§11.2).
 */

/** Longest slug body we will emit, before any de-duplication suffix. */
const MAX_SLUG_LENGTH = 60;

/**
 * Lowercase, de-accent, and hyphenate arbitrary text.
 *
 * Returns `'untitled'` rather than an empty string so that a caller can always
 * build a valid id from the result.
 */
export function slugify(text: string): string {
  const normalised = text
    .normalize('NFKD')
    // Strip combining marks left behind by NFKD so "Café" → "cafe", not "cafe`".
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Drop apostrophes rather than hyphenating them: "reader's" → "readers".
    .replace(/['‘’ʼ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalised.length === 0) return 'untitled';
  return truncateAtWordBoundary(normalised, MAX_SLUG_LENGTH);
}

/**
 * Cut a hyphenated slug to `limit` characters without leaving a partial word.
 * Falls back to a hard cut when the first word is already longer than `limit`.
 */
function truncateAtWordBoundary(slug: string, limit: number): string {
  if (slug.length <= limit) return slug;

  const hardCut = slug.slice(0, limit);
  const lastHyphen = hardCut.lastIndexOf('-');
  if (lastHyphen <= 0) return hardCut;
  return hardCut.slice(0, lastHyphen);
}

/**
 * Return `candidate`, or `candidate-2`, `candidate-3`… if it is already taken.
 * Mutates `taken` so a caller can walk a document in order.
 *
 * why (§8.1): duplicate titles are a content smell the validator warns about,
 * but they must never produce two elements with the same id.
 */
export function uniqueSlug(candidate: string, taken: Set<string>): string {
  if (!taken.has(candidate)) {
    taken.add(candidate);
    return candidate;
  }

  let suffix = 2;
  while (taken.has(`${candidate}-${suffix}`)) suffix += 1;

  const unique = `${candidate}-${suffix}`;
  taken.add(unique);
  return unique;
}

/** Id for a `<doc-section title="What we are building">` → `sec-what-we-are-building`. */
export function sectionId(title: string): string {
  return `sec-${slugify(title)}`;
}

/** Id for a `<doc-choice question="…">` → `q-<slug>`. */
export function questionId(question: string): string {
  return `q-${slugify(question)}`;
}

/** Id for a `<doc-stage title="…">` → `stage-<slug>`. */
export function stageId(title: string): string {
  return `stage-${slugify(title)}`;
}

/** Id for a `<doc-collapse title="…">` → `col-<slug>`. */
export function collapseId(title: string): string {
  return `col-${slugify(title)}`;
}

/** One element that needs an id, in document order. */
export interface IdCandidate {
  /** The author's `id=` attribute, when they wrote one. */
  readonly explicitId: string | null;
  /** The id the runtime would derive, e.g. `sec-what-we-are-building`. */
  readonly derivedId: string;
}

/**
 * Resolve a document's ids in one pass.
 *
 * why: the browser runtime walks a live DOM and the Node validator walks a
 * parse5 tree, but both MUST land on identical ids or `doc-ref` resolution
 * would pass validation and then break at runtime. Each side builds the
 * candidate list from its own tree and hands it to this one function.
 *
 * Explicit ids are reserved first so a derived id can never steal one that the
 * author wrote further down the document.
 */
export function resolveIds(candidates: readonly IdCandidate[]): string[] {
  const taken = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.explicitId) taken.add(candidate.explicitId);
  }

  return candidates.map((candidate) => {
    if (candidate.explicitId) return candidate.explicitId;
    return uniqueSlug(candidate.derivedId, taken);
  });
}
