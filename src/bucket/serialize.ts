/**
 * The `FB v1` wire format — writer and reader.
 *
 * MUST (§10.3): the format is byte-compatible in both directions, so a bucket
 * collected against an earlier build still parses. `tests/golden/bucket-v1.txt`
 * is the checked-in specimen and `tests/node/serialize.test.ts` asserts
 * `serialize(parse(x)) === x` against it.
 *
 * Serialisation rules that this format exists to guarantee:
 *   · Answers carry the question text and the chosen option labels **verbatim**,
 *     so a pasted bucket is self-contained in a fresh session with no access to
 *     the original file.
 *   · The note serialises as `n:` and is omitted when empty.
 *   · An Other answer serialises the reader's typed text as the answer label.
 *
 * ```
 * === FB v1 · vendor-orders · 2026-07-28T10:22:31Z · 2 items ===
 *
 * [1] ANSWER q-should-read-state-be-shared
 * q: Should read state be shared across the vendor team?
 * a: Yes — shared team inbox
 * n: only if we can still see who read it
 *
 * [2] COMMENT sec-what-we-are-building
 * at: 1 What we are building
 * > the moment a new order lands
 * c: is this the payment webhook or the order row?
 *
 * === end FB v1 ===
 * ```
 */

/** Continuation prefix for the second and later lines of a multi-line field. */
const CONTINUATION = '   ';

const HEADER_PATTERN = /^=== FB v1 · (.*?) · (.*?) · (\d+) items? ===$/;
const FOOTER = '=== end FB v1 ===';
const ITEM_PATTERN = /^\[(\d+)\] (ANSWER|COMMENT) (.*)$/;

export interface BucketAnswer {
  readonly kind: 'answer';
  /** Id of the `doc-choice` this answers. */
  readonly anchorId: string;
  readonly question: string;
  /** One entry per selected option, in document order. */
  readonly labels: string[];
  readonly note?: string;
}

export interface BucketComment {
  readonly kind: 'comment';
  /** Id of the nearest `doc-*` ancestor of the selection. */
  readonly anchorId: string;
  /** Human-readable location, e.g. `3.1 Data model`. Omitted when unknown. */
  readonly at?: string;
  readonly quote: string;
  readonly comment: string;
}

export type BucketEntry = BucketAnswer | BucketComment;

export interface BucketDocument {
  readonly docId: string;
  /** ISO 8601, seconds precision. Round-tripped verbatim. */
  readonly timestamp: string;
  readonly entries: BucketEntry[];
}

/** One item that could not be parsed. It invalidates only itself (§10.3). */
export interface BucketProblem {
  readonly index: number;
  readonly reason: string;
  readonly raw: string;
}

export interface ParseResult {
  readonly document: BucketDocument | null;
  readonly problems: BucketProblem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Writing
// ─────────────────────────────────────────────────────────────────────────────

/** Render a bucket to the exact text the Copy button puts on the clipboard. */
export function serializeBucket(bucket: BucketDocument): string {
  const count = bucket.entries.length;
  const noun = count === 1 ? 'item' : 'items';

  const blocks = bucket.entries.map((entry, index) => serializeEntry(entry, index + 1));

  return [
    `=== FB v1 · ${bucket.docId} · ${bucket.timestamp} · ${count} ${noun} ===`,
    '',
    ...interleaveWithBlankLines(blocks),
    FOOTER,
    '',
  ].join('\n');
}

function interleaveWithBlankLines(blocks: readonly string[]): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    lines.push(block, '');
  }
  return lines;
}

function serializeEntry(entry: BucketEntry, position: number): string {
  if (entry.kind === 'answer') {
    const lines = [`[${position}] ANSWER ${entry.anchorId}`, field('q', entry.question)];
    for (const label of entry.labels) lines.push(field('a', label));
    if (entry.note) lines.push(field('n', entry.note));
    return lines.join('\n');
  }

  const lines = [`[${position}] COMMENT ${entry.anchorId}`];
  if (entry.at) lines.push(field('at', entry.at));
  lines.push(quoteBlock(entry.quote), field('c', entry.comment));
  return lines.join('\n');
}

/**
 * `key: first line` with any further lines indented.
 *
 * why folding rather than escaping newlines: a reader's note is prose, and the
 * agent that reads the bucket back should see prose. Three spaces is
 * unambiguous — the parser strips exactly three, so a note whose own line starts
 * with spaces survives intact.
 */
function field(key: string, value: string): string {
  const [first = '', ...rest] = value.split('\n');
  const lines = [`${key}: ${first}`];
  for (const line of rest) lines.push(`${CONTINUATION}${line}`);
  return lines.join('\n');
}

/** The selected excerpt, one `> ` per line. */
function quoteBlock(quote: string): string {
  return quote
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a pasted bucket.
 *
 * MUST (§10.3): a malformed item invalidates only itself. Everything else is
 * processed and the broken one is reported, because a reader who spent twenty
 * minutes on a document should not lose all of it to one bad line.
 */
export function parseBucket(text: string): ParseResult {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const problems: BucketProblem[] = [];

  const headerIndex = lines.findIndex((line) => HEADER_PATTERN.test(line));
  if (headerIndex < 0) {
    return {
      document: null,
      problems: [{ index: 0, reason: 'No `=== FB v1 · … ===` header found.', raw: lines[0] ?? '' }],
    };
  }

  const header = HEADER_PATTERN.exec(lines[headerIndex] ?? '');
  const docId = header?.[1] ?? '';
  const timestamp = header?.[2] ?? '';

  const body = lines.slice(headerIndex + 1).filter((line) => line !== FOOTER);
  const entries: BucketEntry[] = [];

  for (const block of splitIntoItemBlocks(body)) {
    const entry = parseEntry(block.lines);
    if (entry) {
      entries.push(entry);
      continue;
    }
    problems.push({
      index: block.position,
      reason: 'Item is missing a required field.',
      raw: block.lines.join('\n'),
    });
  }

  return { document: { docId, timestamp, entries }, problems };
}

interface ItemBlock {
  readonly position: number;
  readonly lines: string[];
}

/** Group body lines into `[n] KIND …` blocks, ignoring blank separators. */
function splitIntoItemBlocks(lines: readonly string[]): ItemBlock[] {
  const blocks: ItemBlock[] = [];
  let current: string[] | null = null;
  let position = 0;

  for (const line of lines) {
    const match = ITEM_PATTERN.exec(line);
    if (match) {
      if (current) blocks.push({ position, lines: current });
      position = Number(match[1]);
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }

  if (current) blocks.push({ position, lines: current });
  return blocks.map((block) => ({ ...block, lines: trimTrailingBlanks(block.lines) }));
}

function trimTrailingBlanks(lines: readonly string[]): string[] {
  const copy = [...lines];
  while (copy.length > 0 && copy[copy.length - 1]?.trim() === '') copy.pop();
  return copy;
}

function parseEntry(lines: readonly string[]): BucketEntry | null {
  const head = ITEM_PATTERN.exec(lines[0] ?? '');
  if (!head) return null;

  const kind = head[2];
  const anchorId = (head[3] ?? '').trim();
  const fields = readFields(lines.slice(1));

  if (kind === 'ANSWER') {
    const question = fields.get('q')?.[0];
    const labels = fields.get('a') ?? [];
    if (question === undefined || labels.length === 0) return null;

    const note = fields.get('n')?.[0];
    const answer: BucketAnswer = { kind: 'answer', anchorId, question, labels };
    return note === undefined ? answer : { ...answer, note };
  }

  const comment = fields.get('c')?.[0];
  const quote = fields.get('>')?.join('\n');
  if (comment === undefined || quote === undefined) return null;

  const at = fields.get('at')?.[0];
  const result: BucketComment = { kind: 'comment', anchorId, quote, comment };
  return at === undefined ? result : { ...result, at };
}

/**
 * Collect `key: value` lines, folding indented continuations back in.
 *
 * Quote lines are gathered under the pseudo-key `>` so a multi-line excerpt
 * reassembles in order.
 */
function readFields(lines: readonly string[]): Map<string, string[]> {
  const fields = new Map<string, string[]>();
  let currentKey: string | null = null;

  for (const line of lines) {
    if (line.startsWith(CONTINUATION) && currentKey) {
      appendToLast(fields, currentKey, `\n${line.slice(CONTINUATION.length)}`);
      continue;
    }

    if (line.startsWith('> ')) {
      push(fields, '>', line.slice(2));
      currentKey = '>';
      continue;
    }

    const separator = line.indexOf(': ');
    if (separator <= 0) continue;

    currentKey = line.slice(0, separator);
    push(fields, currentKey, line.slice(separator + 2));
  }

  return fields;
}

function push(fields: Map<string, string[]>, key: string, value: string): void {
  const existing = fields.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  fields.set(key, [value]);
}

function appendToLast(fields: Map<string, string[]>, key: string, suffix: string): void {
  const existing = fields.get(key);
  if (!existing || existing.length === 0) return;
  existing[existing.length - 1] = `${existing[existing.length - 1] ?? ''}${suffix}`;
}
