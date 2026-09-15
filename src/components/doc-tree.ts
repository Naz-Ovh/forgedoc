/**
 * `<doc-tree root="src/">` — a directory tree drawn from indented text.
 *
 * why (§8.6): plans reference paths constantly, a real tree beats prose paths,
 * and indented text is the cheapest thing for the agent to write. The runtime
 * draws the connectors so the agent never types `├──`.
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart } from '../core/parts.js';

interface TreeRow {
  readonly depth: number;
  readonly label: string;
}

export class DocTree extends DocElement {
  protected enhance(): void {
    const source = this.textContent ?? '';
    const rows = parseIndentedTree(source);
    if (rows.length === 0) return;

    this.internals.role = 'tree';

    const list = createPart('list', 'div');
    const root = this.attr('root');
    if (root) list.append(this.#createRow({ depth: -1, label: root }, false, true));

    rows.forEach((row, index) => {
      list.append(this.#createRow(row, hasFollowingSibling(rows, index), false));
    });

    this.#removeRawSource();
    this.append(list);

    appendFeedbackButton(this, root, { icon: true });
  }

  #createRow(row: TreeRow, hasFollowingSibling: boolean, isRoot: boolean): HTMLElement {
    const element = createPart('node', 'div');
    element.setAttribute('role', 'treeitem');
    element.dataset.depth = String(Math.max(row.depth, 0));

    if (!isRoot) {
      const connector = createPart('connector', 'span', {
        text: hasFollowingSibling ? '├─' : '└─',
      });
      connector.setAttribute('aria-hidden', 'true');
      element.append(connector);
    }

    element.append(createPart('label', 'span', { text: row.label }));
    if (row.label.endsWith('/')) element.dataset.kind = 'directory';
    return element;
  }

  #removeRawSource(): void {
    for (const node of Array.from(this.childNodes)) {
      const isChrome = node instanceof HTMLElement && node.dataset.docChrome !== undefined;
      if (isChrome) continue;
      node.remove();
    }
  }
}

/**
 * True when another row at the same depth follows before the tree pops out to a
 * shallower level — i.e. this row draws `├─` rather than `└─`.
 */
function hasFollowingSibling(rows: readonly TreeRow[], index: number): boolean {
  const depth = rows[index]?.depth ?? 0;

  for (let position = index + 1; position < rows.length; position += 1) {
    const candidate = rows[position];
    if (!candidate) break;
    if (candidate.depth < depth) return false;
    if (candidate.depth === depth) return true;
  }
  return false;
}

/**
 * Indented plain text → rows with a normalised depth.
 *
 * Indentation width is inferred from the smallest non-zero indent, so both
 * two-space and four-space trees produce the same depths. Any connector
 * characters the agent typed anyway are stripped.
 */
export function parseIndentedTree(source: string): TreeRow[] {
  const rawLines = source.split('\n').filter((line) => line.trim() !== '');
  if (rawLines.length === 0) return [];

  const indents = rawLines.map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);
  const nonZero = indents.filter((indent) => indent > 0);
  const unit = nonZero.length > 0 ? Math.min(...nonZero) : 1;

  return rawLines.map((line, index) => ({
    depth: Math.round((indents[index] ?? 0) / unit),
    label:
      line
        .trim()
        .replace(/^[│├└─\s|`+-]+/u, '')
        .trim() || line.trim(),
  }));
}
