/**
 * `data-part` query helpers.
 *
 * why this exists (§7.4): with no shadow DOM, an author *can* select internal
 * class names — which means they *will*, and the next refactor breaks their
 * plan. `data-part` is the deliberate, documented, semver-covered surface
 * instead. It gives `::part()` ergonomics with no shadow root and leaves the
 * library free to restructure everything else.
 */

import { isEmbeddedTag, isPhrasingTag } from './contract.js';

/** True for `<doc-anything>`. */
export function isDocElement(node: Element): boolean {
  return node.tagName.toLowerCase().startsWith('doc-');
}

/** Nearest `doc-*` ancestor of `node`, exclusive of `node` itself. */
export function nearestPlanAncestor(node: Element): Element | null {
  let current = node.parentElement;
  while (current) {
    if (isDocElement(current)) return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * All parts named `name` that belong to `owner`.
 *
 * MUST (§7.4): this must not match parts of nested components. A `doc-choice`
 * asking for its own `[data-part="body"]` must not receive the body of a
 * `doc-note` a reader happened to nest inside one of its options. Scoping by
 * "nearest plan ancestor is me" is the only rule that survives arbitrary
 * nesting depth.
 */
export function partsOf(owner: Element, name: string): HTMLElement[] {
  const selector = `[data-part="${CSS.escape(name)}"]`;
  const matches = Array.from(owner.querySelectorAll<HTMLElement>(selector));
  return matches.filter((match) => nearestPlanAncestor(match) === owner);
}

/** The first part named `name` belonging to `owner`, or null. */
export function partOf(owner: Element, name: string): HTMLElement | null {
  return partsOf(owner, name)[0] ?? null;
}

/**
 * Create a chrome element carrying a public part name.
 *
 * Chrome is always *appended* — never used to wrap author content (§2.2). The
 * `data-doc-chrome` marker is what lets `authorChildren` tell the two apart.
 */
export function createPart(
  name: string,
  tagName: keyof HTMLElementTagNameMap = 'div',
  options: { text?: string; className?: string } = {},
): HTMLElement {
  const element = document.createElement(tagName);
  element.dataset.part = name;
  element.dataset.docChrome = '';
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  return element;
}

/**
 * Direct element children of `owner` that the author wrote.
 *
 * Components need this to walk author content without tripping over their own
 * badges, chevrons and textareas.
 *
 * why `Element` rather than `HTMLElement`: an `<svg>` inside a `doc-figure` is
 * an `SVGElement`, and an `instanceof HTMLElement` test silently skips it —
 * which is how figures ended up with no content part. Both interfaces implement
 * `HTMLOrSVGElement`, so `dataset` is available on either.
 */
export function authorChildren(owner: Element): HTMLElement[] {
  return Array.from(owner.children).filter(
    (child): child is HTMLElement => datasetOf(child)?.docChrome === undefined,
  );
}

/** `dataset` for any element that has one — HTML and SVG both do. */
function datasetOf(element: Element): DOMStringMap | null {
  return (element as Partial<HTMLOrSVGElement>).dataset ?? null;
}

/** True for an element that belongs inside a sentence rather than around one. */
export function isPhrasingElement(element: Element): boolean {
  return isPhrasingTag(element.tagName);
}

/** Options for `nameAuthorContent`. */
export interface NameOptions {
  /**
   * Treat `<svg>`, `<img>` and the other embedded tags as content rather than
   * as part of a sentence. For components whose body *is* an embedded object —
   * `doc-figure` — where there is no sentence for it to be part of.
   */
  readonly includeEmbedded?: boolean;
}

/**
 * True when `owner` holds loose prose — bare text, inline markup, or both —
 * rather than only block children the component can name and lay out.
 */
export function hasFlowContent(owner: Element, options: NameOptions = {}): boolean {
  for (const node of Array.from(owner.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? '').trim() !== '') return true;
      continue;
    }
    if (!(node instanceof Element)) continue;
    if (datasetOf(node)?.docChrome !== undefined) continue;
    if (options.includeEmbedded && isEmbeddedTag(node.tagName)) continue;
    if (isPhrasingElement(node)) return true;
  }
  return false;
}

/**
 * Mark the author's own children as a named part, without wrapping them.
 *
 * why (§2.2 vs §7.4): the spec's example CSS selects `[data-part="body"]` inside
 * a component, but creating that wrapper would mean moving author nodes into it
 * — the one thing `enhance()` may never do. Naming the children *in place*
 * gives the same public selector with no reparenting: `doc-note
 * [data-part="body"]` still matches, and `partOf(el, 'body')` still resolves.
 *
 * MUST: only *block* children are named. An agent writing a step body as a
 * sentence — `The <code>id</code> column` — gives the component three children:
 * two text nodes and a `<code>`. Naming that `<code>` as the body applied the
 * body's block typography to one word mid-sentence, which is how a paragraph
 * ended up rendered as three stacked rows. Phrasing content is part of the
 * sentence, never the container for it.
 *
 * Note that a component whose content is a bare text node — `doc-quote`,
 * `doc-flow-node`'s subtitle — has no element to name. Those, and any component
 * the author wrote loose prose into, get `data-doc-flow` on the host instead so
 * a stylesheet can put the body typography there; see their stylesheets.
 */
export function nameAuthorContent(
  owner: Element,
  name: string,
  options: NameOptions = {},
): HTMLElement[] {
  const named: HTMLElement[] = [];

  for (const child of authorChildren(owner)) {
    const embedded = options.includeEmbedded && isEmbeddedTag(child.tagName);
    if (!embedded && isPhrasingElement(child)) continue;
    const dataset = datasetOf(child);
    if (dataset && dataset.part === undefined) dataset.part = name;
    named.push(child);
  }

  if (hasFlowContent(owner, options)) {
    const dataset = datasetOf(owner);
    if (dataset) dataset.docFlow = '';
  }

  return named;
}
