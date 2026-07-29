/**
 * `<plan-diff lang="ts" filename="src/store.ts">` — a unified diff.
 *
 * why its own component (§8.6): faking this with `plan-tabs` plus two
 * `plan-code` blocks loses the line-by-line alignment, which is the only reason
 * a diff is easier to read than two files side by side.
 */

import { PlanElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart } from '../core/parts.js';
import { readBlockText } from '../core/text.js';
import { highlightToHtml } from '../vendor/highlight.js';

type LineKind = 'add' | 'remove' | 'context' | 'meta';

interface DiffLine {
  readonly kind: LineKind;
  readonly text: string;
  /** Line number in the old file, or null for an added line. */
  readonly oldNumber: number | null;
  /** Line number in the new file, or null for a removed line. */
  readonly newNumber: number | null;
}

export class PlanDiff extends PlanElement {
  protected enhance(): void {
    // MUST dedent before parsing: without it every line still begins with the
    // markup's own indentation, `+`/`-` no longer start the line, and the whole
    // diff classifies as unchanged context.
    const source = readBlockText(this);
    if (source === '') return;

    this.internals.role = 'group';
    this.internals.ariaLabel = `Diff${this.attr('filename') ? ` for ${this.attr('filename')}` : ''}`;

    const lines = parseUnifiedDiff(source);
    this.#prependHeader(lines);
    this.#render(lines);

    appendFeedbackButton(this, this.attr('filename'), this.findPart('header'));
  }

  #prependHeader(lines: readonly DiffLine[]): void {
    const header = createPart('header', 'div');

    const filename = this.attr('filename');
    if (filename) header.append(createPart('filename', 'span', { text: filename }));

    const added = lines.filter((line) => line.kind === 'add').length;
    const removed = lines.filter((line) => line.kind === 'remove').length;
    header.append(createPart('stat-add', 'span', { text: `+${added}` }));
    header.append(createPart('stat-remove', 'span', { text: `−${removed}` }));

    this.prepend(header);
  }

  /**
   * Build one row per line: two gutters plus the highlighted text.
   *
   * Same content-substitution exception as `plan-code` — the raw diff text is
   * replaced by the rendered table. See docs/DECISIONS.md.
   */
  #render(lines: readonly DiffLine[]): void {
    const language = this.attr('lang', 'text');
    const body = createPart('code', 'div');

    for (const line of lines) {
      const row = createPart('row', 'div');
      row.dataset.kind = line.kind;

      row.append(
        createPart('old-number', 'span', { text: line.oldNumber?.toString() ?? '' }),
        createPart('new-number', 'span', { text: line.newNumber?.toString() ?? '' }),
        createPart('sign', 'span', { text: signFor(line.kind) }),
      );

      const text = createPart('text', 'span');
      text.innerHTML = highlightToHtml(line.text, line.kind === 'meta' ? 'text' : language);
      row.append(text);

      body.append(row);
    }

    this.#removeRawSource();
    this.append(body);
  }

  #removeRawSource(): void {
    for (const node of Array.from(this.childNodes)) {
      const isChrome = node instanceof HTMLElement && node.dataset.planChrome !== undefined;
      if (isChrome) continue;
      node.remove();
    }
  }
}

const SIGNS: Record<LineKind, string> = { add: '+', remove: '−', context: ' ', meta: '' };

function signFor(kind: LineKind): string {
  return SIGNS[kind];
}

/**
 * Parse unified diff text into numbered rows.
 *
 * Understands `@@ -a,b +c,d @@` hunk headers so the gutters show real file line
 * numbers rather than a running count. Anything it cannot classify becomes a
 * `meta` row, which is how `diff --git` preambles render.
 */
export function parseUnifiedDiff(source: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNumber = 1;
  let newNumber = 1;

  for (const raw of source.split('\n')) {
    const hunk = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      lines.push({ kind: 'meta', text: raw, oldNumber: null, newNumber: null });
      continue;
    }

    if (raw.startsWith('+++') || raw.startsWith('---') || raw.startsWith('diff ')) {
      lines.push({ kind: 'meta', text: raw, oldNumber: null, newNumber: null });
      continue;
    }

    if (raw.startsWith('+')) {
      lines.push({ kind: 'add', text: raw.slice(1), oldNumber: null, newNumber });
      newNumber += 1;
      continue;
    }

    if (raw.startsWith('-')) {
      lines.push({ kind: 'remove', text: raw.slice(1), oldNumber, newNumber: null });
      oldNumber += 1;
      continue;
    }

    lines.push({ kind: 'context', text: raw.replace(/^ /, ''), oldNumber, newNumber });
    oldNumber += 1;
    newNumber += 1;
  }

  return lines;
}
