/**
 * Validates a ForgeDoc document against the markup contract (§13.1).
 *
 * Designed to be fast enough to run in a pre-commit hook and predictable
 * enough to run in an agent harness:
 *
 * 1. Errors carry the exact line number, a fix suggestion, and an explanation.
 * 2. Every rule maps 1:1 to a subsection of the contract.
 * 3. An exit code of 0 means the document can be safely built.
 */

import {
  CODE_LANGUAGES,
  GLOBAL_ATTRIBUTES,
  isKnownTag,
  PRESET_AXES,
  TAG_NAMES,
  TAGS,
  type TagName,
  type TagSpec,
} from '../src/core/contract.js';
import { isValidExpand } from '../src/core/mindmap.js';
import { type IdCandidate, resolveIds, slugify } from '../src/core/slug.js';

export interface Diagnostic {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly ruleId: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly fix: string;
}

export interface ValidationResult {
  readonly file: string;
  readonly ok: boolean;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ValidateOptions {
  readonly file?: string;
  readonly expectBuilt?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Parser & AST
// ─────────────────────────────────────────────────────────────────────────────

interface Position {
  line: number;
  column: number;
}

interface Attribute {
  name: string;
  value: string;
  position: Position;
}

interface Element {
  tagName: string;
  attributes: Attribute[];
  children: (Element | TextNode)[];
  parent: Element | null;
  position: Position;
  isSelfClosing: boolean;
}

interface TextNode {
  type: 'text';
  text: string;
  position: Position;
}

function parseHtml(html: string): Element[] {
  const roots: Element[] = [];
  const stack: Element[] = [];
  let index = 0;
  let line = 1;
  let lineStart = 0;

  function getPosition(): Position {
    return { line, column: index - lineStart + 1 };
  }

  function advance(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      if (html[index] === '\n') {
        line++;
        lineStart = index + 1;
      }
      index++;
    }
  }

  while (index < html.length) {
    if (html.startsWith('<!--', index)) {
      const end = html.indexOf('-->', index + 4);
      if (end === -1) break;
      advance(end + 3 - index);
      continue;
    }

    if (html.startsWith('<!doctype', index) || html.startsWith('<!DOCTYPE', index)) {
      const end = html.indexOf('>', index);
      if (end === -1) break;
      advance(end + 1 - index);
      continue;
    }

    if (html.startsWith('</', index)) {
      const end = html.indexOf('>', index + 2);
      if (end === -1) break;
      const tag = html
        .slice(index + 2, end)
        .trim()
        .toLowerCase();
      advance(end + 1 - index);

      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]?.tagName === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    if (html.startsWith('<', index)) {
      const pos = getPosition();
      const end = html.indexOf('>', index + 1);
      if (end === -1) break;

      const tagContent = html.slice(index + 1, end).trim();
      const isSelfClosing = tagContent.endsWith('/');
      const cleanContent = isSelfClosing ? tagContent.slice(0, -1).trim() : tagContent;

      const tagMatch = cleanContent.match(/^[a-zA-Z0-9_-]+/);
      if (!tagMatch) {
        advance(1);
        continue;
      }

      const tagName = tagMatch[0].toLowerCase();
      const attrStr = cleanContent.slice(tagName.length);
      const attributes: Attribute[] = [];

      const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let match = attrRegex.exec(attrStr);
      while (match !== null) {
        attributes.push({
          name: match[1]?.toLowerCase() ?? '',
          value: match[2] ?? match[3] ?? match[4] ?? '',
          position: pos,
        });
        match = attrRegex.exec(attrStr);
      }

      const elem: Element = {
        tagName,
        attributes,
        children: [],
        parent: stack[stack.length - 1] ?? null,
        position: pos,
        isSelfClosing,
      };

      if (stack.length > 0) {
        stack[stack.length - 1]?.children.push(elem);
      } else {
        roots.push(elem);
      }

      advance(end + 1 - index);

      const VOID_ELEMENTS = new Set([
        'area',
        'base',
        'br',
        'col',
        'embed',
        'hr',
        'img',
        'input',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
      ]);

      if (!isSelfClosing && !VOID_ELEMENTS.has(tagName)) {
        if (tagName === 'script' || tagName === 'style') {
          const closeTag = `</${tagName}>`;
          const closeIndex = html.toLowerCase().indexOf(closeTag, index);
          if (closeIndex !== -1) {
            const rawText = html.slice(index, closeIndex);
            elem.children.push({ type: 'text', text: rawText, position: getPosition() });
            advance(closeIndex + closeTag.length - index);
          }
        } else {
          stack.push(elem);
        }
      }
      continue;
    }

    const nextTag = html.indexOf('<', index);
    const textEnd = nextTag === -1 ? html.length : nextTag;
    const text = html.slice(index, textEnd);
    if (text.trim().length > 0 && stack.length > 0) {
      stack[stack.length - 1]?.children.push({
        type: 'text',
        text,
        position: getPosition(),
      });
    }
    advance(textEnd - index);
  }

  return roots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Levenshtein & Nearest Tag
// ─────────────────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: (m + 1) * (n + 1) }, () => 0);
  const get = (i: number, j: number) => dp[i * (n + 1) + j] ?? 0;
  const set = (i: number, j: number, v: number) => {
    dp[i * (n + 1) + j] = v;
  };

  for (let i = 0; i <= m; i++) set(i, 0, i);
  for (let j = 0; j <= n; j++) set(0, j, j);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        set(i, j, get(i - 1, j - 1));
      } else {
        set(i, j, 1 + Math.min(get(i - 1, j), get(i, j - 1), get(i - 1, j - 1)));
      }
    }
  }

  return get(m, n);
}

function nearestTag(unknown: string): string | null {
  let closest: string | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const tag of TAG_NAMES) {
    const dist = levenshtein(unknown, tag);
    if (dist < minDistance) {
      minDistance = dist;
      closest = tag;
    }
  }

  return closest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Engine
// ─────────────────────────────────────────────────────────────────────────────

class Validator {
  readonly #diagnostics: Diagnostic[] = [];
  readonly #idCandidates: IdCandidate[] = [];
  readonly #idOwners: Element[] = [];
  readonly #refs: { element: Element; target: string; position: Position }[] = [];
  readonly #expectBuilt: boolean;
  readonly #file: string;
  #hasDocChoice = false;

  constructor(options: ValidateOptions = {}) {
    this.#expectBuilt = options.expectBuilt ?? false;
    this.#file = options.file ?? 'inline';
  }

  error(ruleId: string, message: string, fix: string, pos: Position): void {
    this.#diagnostics.push({
      file: this.#file,
      line: pos.line,
      column: pos.column,
      ruleId,
      severity: 'error',
      message,
      fix,
    });
  }

  warning(ruleId: string, message: string, fix: string, pos: Position): void {
    this.#diagnostics.push({
      file: this.#file,
      line: pos.line,
      column: pos.column,
      ruleId,
      severity: 'warning',
      message,
      fix,
    });
  }

  validate(source: string): ValidationResult {
    if (this.#expectBuilt) {
      this.#checkPlaceholders(source);
    }

    const roots = parseHtml(source);
    const docPages: Element[] = [];

    function findDocPages(elements: Element[]): void {
      for (const el of elements) {
        if (el.tagName === 'doc-page') {
          docPages.push(el);
        }
        findDocPages(el.children.filter((c): c is Element => 'tagName' in c));
      }
    }
    findDocPages(roots);

    if (docPages.length === 0) {
      this.error(
        'doc/missing',
        'No <doc-page> element found in the document.',
        'Wrap your content in a <doc-page doc-id="..."> element to create a valid plan document.',
        { line: 1, column: 1 },
      );
      return this.#result();
    }

    if (docPages.length > 1) {
      const second = docPages[1];
      if (second) {
        this.error(
          'doc/duplicate',
          'Found multiple <doc-page> root elements. A document must have exactly one.',
          'Remove the extra <doc-page> elements and keep only one root.',
          positionOf(second),
        );
      }
    }

    const docPage = docPages[0];
    if (docPage) {
      this.#validateDocPage(docPage);
      this.#walk(docPage, []);
    }

    this.#validateCrossElementReferences();

    if (!this.#hasDocChoice) {
      this.warning(
        'doc/no-choice',
        'The document contains no <doc-choice>.',
        'A plan with no questions collects no feedback. Add at least one <doc-choice> for the decisions you are unsure about.',
        { line: docPage?.position.line ?? 1, column: docPage?.position.column ?? 1 },
      );
    }

    return this.#result();
  }

  #checkPlaceholders(source: string): void {
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.includes('/*@DOC_CSS') || line.includes('//@DOC_JS@')) {
        this.error(
          'build/unreplaced-placeholder',
          'Document contains unreplaced build placeholders.',
          'Run `forgedoc build <file>` to inject stylesheets and runtime assets.',
          { line: i + 1, column: 1 },
        );
      }
    }
  }

  #validateDocPage(docPage: Element): void {
    const docId = attributeOf(docPage, 'doc-id');
    if (!docId) {
      this.error(
        'doc/missing-doc-id',
        '<doc-page> must have a doc-id attribute.',
        'Add a doc-id attribute: <doc-page doc-id="my-plan">',
        positionOf(docPage),
      );
    } else if (!/^[a-z0-9-]+$/.test(docId)) {
      this.error(
        'attr/invalid-value',
        `Invalid doc-id "${docId}". Must be lowercase alphanumeric with hyphens.`,
        `Change doc-id to "${slugify(docId)}"`,
        positionOf(docPage),
      );
    }

    for (const [axisName, allowedValues] of Object.entries(PRESET_AXES)) {
      const val = attributeOf(docPage, axisName);
      if (val !== null && !(allowedValues as readonly string[]).includes(val)) {
        this.error(
          'attr/invalid-value',
          `Invalid value "${val}" for preset axis "${axisName}".`,
          `Allowed values: ${(allowedValues as readonly string[]).join(' | ')}`,
          positionOf(docPage),
        );
      }
    }
  }

  #walk(element: Element, ancestors: Element[]): void {
    const tagName = element.tagName;

    if (tagName === 'script') this.#validateScript(element, ancestors);
    if (element.isSelfClosing && tagName.startsWith('doc-')) this.#reportSelfClosing(element);

    if (isKnownTag(tagName)) {
      this.#validateDocElement(element, tagName, ancestors);
    } else if (tagName.startsWith('doc-')) {
      const suggestion = nearestTag(tagName);
      const fix = suggestion
        ? `Did you mean <${suggestion}>? Run \`forgedoc cheatsheet\` for the supported tags.`
        : 'Run `forgedoc cheatsheet` for the list of supported tags.';
      this.error('tag/unknown', `Unknown tag <${tagName}>.`, fix, positionOf(element));
    }

    const currentAncestors = [...ancestors, element];
    for (const child of element.children) {
      if ('tagName' in child) {
        this.#walk(child, currentAncestors);
      }
    }
  }

  #validateDocElement(element: Element, tagName: TagName, ancestors: Element[]): void {
    const spec = TAGS[tagName] as TagSpec;

    if (spec.generated && !this.#expectBuilt) {
      this.error(
        'toc/authored',
        `<${tagName}> is generated by the runtime. Do not author it directly.`,
        `Remove the <${tagName}> element and let the runtime build the table of contents automatically.`,
        positionOf(element),
      );
    }

    this.#validatePlacement(element, tagName, spec, ancestors);
    this.#validateAttributes(element, tagName, spec);
    this.#validateChildren(element, tagName, spec);
    this.#collectIdentity(element, tagName, ancestors);
  }

  #validatePlacement(
    element: Element,
    tagName: TagName,
    spec: TagSpec,
    ancestors: Element[],
  ): void {
    if (spec.onlyInside) {
      const parent = ancestors[ancestors.length - 1];
      const valid = parent && spec.onlyInside.includes(parent.tagName as TagName);
      if (!valid) {
        const allowed = spec.onlyInside.map((t) => `<${t}>`).join(' or ');
        this.error(
          'child/misplaced',
          `<${tagName}> is only valid inside ${allowed}.`,
          `Move <${tagName}> inside ${allowed}.`,
          positionOf(element),
        );
      }
    }

    if (tagName === 'doc-section') {
      const sectionDepth = ancestors.filter((a) => a.tagName === 'doc-section').length + 1;
      if (sectionDepth > 3) {
        this.warning(
          'section/too-deep',
          'Section nesting exceeds the recommended maximum depth of 3.',
          'Flatten the document structure so readers do not have to navigate deeply nested sections.',
          positionOf(element),
        );
      }
    }
  }

  #validateAttributes(element: Element, tagName: TagName, spec: TagSpec): void {
    for (const attr of element.attributes) {
      const attrName = attr.name;

      if (attrName === 'style') {
        this.warning(
          'attr/inline-style',
          'Inline styles are forbidden on ForgeDoc semantic elements.',
          'Remove style attribute and use token classes or semantic attributes.',
          attr.position,
        );
        continue;
      }

      if (Object.hasOwn(GLOBAL_ATTRIBUTES, attrName)) continue;

      const attrDef = spec.attributes[attrName];
      if (!attrDef) {
        this.error(
          'attr/unknown',
          `Unknown attribute "${attrName}" on <${tagName}>.`,
          `Run \`forgedoc info ${tagName}\` for the attributes it accepts.`,
          attr.position,
        );
        continue;
      }

      const val = attr.value;
      if (attrDef.kind.type === 'enum' && !attrDef.kind.values.includes(val)) {
        this.error(
          'attr/invalid-value',
          `Invalid attribute value ${attrName}="${val}" on <${tagName}>.`,
          `Valid values are: ${attrDef.kind.values.join(' | ')}`,
          attr.position,
        );
      } else if (attrDef.kind.type === 'integer' && !/^-?\d+$/.test(val)) {
        this.error(
          'attr/invalid-value',
          `Attribute "${attrName}" on <${tagName}> must be an integer.`,
          'Provide an integer value.',
          attr.position,
        );
      }
    }

    for (const [attrName, def] of Object.entries(spec.attributes)) {
      if (def.required && attributeOf(element, attrName) === null) {
        this.error(
          'attr/missing-required',
          `<${tagName}> is missing required attribute "${attrName}".`,
          `Add "${attrName}" attribute to <${tagName}>.`,
          positionOf(element),
        );
      }
    }

    if (tagName === 'doc-code') {
      const lang = attributeOf(element, 'lang');
      if (lang && !(CODE_LANGUAGES as readonly string[]).includes(lang)) {
        this.error(
          'code/unknown-lang',
          `Unknown code language "${lang}".`,
          `Supported languages: ${CODE_LANGUAGES.join(', ')}`,
          positionOf(element),
        );
      }
    }
  }

  #validateChildren(element: Element, tagName: TagName, spec: TagSpec): void {
    if (spec.requiresChild) {
      for (const req of spec.requiresChild) {
        const hasChild = element.children.some((c) => 'tagName' in c && c.tagName === req);
        if (!hasChild) {
          this.error(
            'child/missing-required',
            `<${tagName}> requires at least one <${req}> child.`,
            `Add a <${req}> child inside <${tagName}>.`,
            positionOf(element),
          );
        }
      }
    }

    if (tagName === 'doc-choice') {
      this.#hasDocChoice = true;
      const options = element.children.filter(
        (c): c is Element => 'tagName' in c && c.tagName === 'doc-option',
      );
      if (options.length < 2) {
        this.error(
          'choice/too-few-options',
          '<doc-choice> must contain at least two <doc-option> elements.',
          'Add at least two <doc-option> children so the reader has real choices.',
          positionOf(element),
        );
      }
    }

    if (tagName === 'doc-walkthrough') this.#validateWalkthrough(element);
    if (tagName === 'doc-mindmap') this.#validateMindmapExpand(element);
    if (tagName === 'doc-node') this.#validateNodeState(element);
    if (tagName === 'doc-figure') this.#validateMermaidSize(element);

    if (tagName === 'doc-figure') {
      const hasCaptionAttr = attributeOf(element, 'caption') !== null;
      const hasCaptionChild = element.children.some(
        (c) => 'tagName' in c && (c.tagName === 'figcaption' || c.tagName === 'doc-caption'),
      );
      if (!hasCaptionAttr && !hasCaptionChild) {
        this.warning(
          'figure/missing-caption',
          '<doc-figure> is missing a caption.',
          'Add a `caption="..."` attribute or a `<figcaption>` / `<doc-caption>` child inside <doc-figure>.',
          positionOf(element),
        );
      }
    }
  }

  /**
   * HTML has no self-closing custom elements: the parser reads `<doc-actor/>`
   * as an *open* tag, so every sibling after it becomes its child. This
   * validator's own parser honours the slash, which is exactly why the browser
   * and the build would disagree about the document without this rule.
   *
   * An error for the tags whose children carry meaning by position — a scene
   * swallowed by an actor never plays — and a warning for the older tags, so a
   * document that built before keeps building.
   */
  #reportSelfClosing(element: Element): void {
    const tag = element.tagName;
    const message = `<${tag} … /> is not self-closing in HTML: the browser nests everything after it inside it.`;
    const fix = `Write an explicit end tag: <${tag} …></${tag}>.`;
    if (STRICT_CLOSING_TAGS.has(tag)) {
      this.error('tag/self-closing', message, fix, positionOf(element));
    } else {
      this.warning('tag/self-closing', message, fix, positionOf(element));
    }
  }

  /** Every actor key a walkthrough's moves, changes and focus lists name must exist. */
  #validateWalkthrough(walkthrough: Element): void {
    const actors = childElements(walkthrough, 'doc-actor');
    const names = new Set<string>();
    for (const actor of actors) {
      const name = attributeOf(actor, 'name');
      if (name === null) continue;
      if (names.has(name)) {
        this.error(
          'walkthrough/duplicate-actor',
          `Two actors in this walkthrough are named "${name}".`,
          'Give every <doc-actor> in a walkthrough its own `name`.',
          positionOf(actor),
        );
      }
      names.add(name);
    }

    const known = [...names].join(', ') || 'none';
    for (const scene of childElements(walkthrough, 'doc-scene')) {
      for (const [element, attribute] of actorReferences(scene)) {
        const value = attributeOf(element, attribute) ?? '';
        const keys = attribute === 'focus' ? value.split(/\s+/).filter(Boolean) : [value];
        for (const key of keys) {
          if (key === '' || names.has(key)) continue;
          this.error(
            'walkthrough/unknown-actor',
            `<${element.tagName} ${attribute}="${value}"> names an actor this walkthrough does not declare: "${key}".`,
            `Use one of the declared actor names (${known}), or add <doc-actor name="${key}"></doc-actor>.`,
            positionOf(element),
          );
        }
      }
    }
  }

  /**
   * `expand` is a string in the contract because it takes words and numbers;
   * this is the check an enum would otherwise have given it.
   */
  #validateMindmapExpand(map: Element): void {
    const expand = attributeOf(map, 'expand');
    if (expand === null || isValidExpand(expand)) return;
    this.error(
      'attr/invalid-value',
      `Invalid attribute value expand="${expand}" on <doc-mindmap>.`,
      'Valid values are: none | all | a whole number of levels, e.g. 1 or 2',
      map.attributes.find((attribute) => attribute.name === 'expand')?.position ?? positionOf(map),
    );
  }

  /** A card cannot start both open and closed; the runtime would pick one silently. */
  #validateNodeState(node: Element): void {
    if (attributeOf(node, 'open') === null || attributeOf(node, 'closed') === null) return;
    this.warning(
      'mindmap/open-and-closed',
      '<doc-node> has both `open` and `closed`; `closed` wins.',
      'Keep the one you mean.',
      positionOf(node),
    );
  }

  /**
   * A soft hint, never an error: a Mermaid graph past a dozen or so statements
   * is usually hard to read at page width. It says so once, and the author
   * decides.
   */
  #validateMermaidSize(figure: Element): void {
    if (attributeOf(figure, 'type') !== 'mermaid') return;
    const source = figure.children
      .filter((child): child is TextNode => 'type' in child)
      .map((child) => child.text)
      .join('\n');
    const statements = source
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('%%')).length;
    if (statements <= MERMAID_HINT_STATEMENTS) return;

    this.warning(
      'figure/large-mermaid',
      `This Mermaid diagram has ${statements} statements; a dense graph is hard to read at page width.`,
      'Optional: split it, show only the part the reader needs, or use <doc-walkthrough> if it describes something that happens step by step.',
      positionOf(figure),
    );
  }

  /**
   * Scripts in a document belong in a `doc-custom` block, typed so the runtime
   * runs them: a plain `<script>` there runs before the page is ready and in
   * the shared global scope, and a `forgedoc` one anywhere else never runs.
   */
  #validateScript(script: Element, ancestors: Element[]): void {
    const type = (attributeOf(script, 'type') ?? '').trim().toLowerCase();
    const inCustom = ancestors.some((ancestor) => ancestor.tagName === 'doc-custom');

    if (inCustom && type !== 'forgedoc') {
      this.warning(
        'custom/plain-script',
        'A plain <script> inside <doc-custom> runs before the page is ready and shares the global scope.',
        'Write <script type="forgedoc">; it runs once the page is ready, with `block` set to this element.',
        positionOf(script),
      );
    }
    if (!inCustom && type === 'forgedoc') {
      this.warning(
        'custom/orphan-script',
        '<script type="forgedoc"> only runs inside a <doc-custom> block.',
        'Move it inside the <doc-custom> it belongs to.',
        positionOf(script),
      );
    }
  }

  /** Record this element's id — explicit or derived — for the duplicate and ref checks. */
  #collectIdentity(element: Element, tagName: TagName, _ancestors: Element[]): void {
    const derivedId = derivedIdFor(element, tagName);
    const explicitId = attributeOf(element, 'id');

    if (derivedId || explicitId) {
      this.#idCandidates.push({
        explicitId,
        derivedId: derivedId ?? explicitId ?? '',
      });
      this.#idOwners.push(element);
    }

    if (tagName === 'doc-section') {
      const title = attributeOf(element, 'title');
      if (title) {
        const slug = slugify(title);
        const duplicate = this.#idCandidates.filter(
          (c, idx) =>
            this.#idOwners[idx]?.tagName === 'doc-section' && c.derivedId === `sec-${slug}`,
        );
        if (duplicate.length > 1) {
          this.warning(
            'section/duplicate-slug',
            `Section title "${title}" produces duplicate slug "sec-${slug}".`,
            'Provide unique section titles or explicit id attributes to avoid anchor collision.',
            positionOf(element),
          );
        }
      }
    }

    if (tagName === 'doc-ref') {
      const target = attributeOf(element, 'to');
      if (target) {
        this.#refs.push({ element, target, position: positionOf(element) });
      }
    }
  }

  #validateCrossElementReferences(): void {
    const resolvedIds = resolveIds(this.#idCandidates);
    const seen = new Set<string>();

    for (let i = 0; i < resolvedIds.length; i++) {
      const id = resolvedIds[i];
      const owner = this.#idOwners[i];
      if (!id || !owner) continue;

      if (seen.has(id)) {
        this.error(
          'id/duplicate',
          `Duplicate id "${id}" on <${owner.tagName}>.`,
          'Ensure all element IDs are unique.',
          positionOf(owner),
        );
      }
      seen.add(id);
    }

    for (const ref of this.#refs) {
      if (!seen.has(ref.target)) {
        this.error(
          'ref/unresolvable',
          `Referenced id "${ref.target}" does not exist in the document.`,
          'Check that the target element has a matching id or slug.',
          ref.position,
        );
      }
    }
  }

  #result(): ValidationResult {
    const errorCount = this.#diagnostics.filter((d) => d.severity === 'error').length;
    const warningCount = this.#diagnostics.filter((d) => d.severity === 'warning').length;
    return {
      file: this.#file,
      ok: errorCount === 0,
      errorCount,
      warningCount,
      diagnostics: this.#diagnostics,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Tags whose self-closed form is an error rather than a warning (see `#reportSelfClosing`). */
const STRICT_CLOSING_TAGS: ReadonlySet<string> = new Set([
  'doc-walkthrough',
  'doc-actor',
  'doc-scene',
  'doc-move',
  'doc-change',
  'doc-custom',
  'doc-mindmap',
  'doc-node',
]);

/** Above this many statements a Mermaid figure gets the `figure/large-mermaid` hint. */
const MERMAID_HINT_STATEMENTS = 15;

function childElements(element: Element, tagName: string): Element[] {
  return element.children.filter(
    (child): child is Element => 'tagName' in child && child.tagName === tagName,
  );
}

/** Each (element, attribute) pair in a scene that names an actor. */
function actorReferences(scene: Element): [Element, string][] {
  const references: [Element, string][] = [];
  if (attributeOf(scene, 'focus') !== null) references.push([scene, 'focus']);
  for (const move of childElements(scene, 'doc-move')) {
    references.push([move, 'from'], [move, 'to']);
  }
  for (const change of childElements(scene, 'doc-change')) references.push([change, 'actor']);
  return references;
}

function positionOf(element: Element): Position {
  return element.position;
}

function attributeOf(element: Element, name: string): string | null {
  const match = element.attributes.find((a) => a.name === name);
  return match ? match.value : null;
}

function derivedIdFor(element: Element, tagName: TagName): string | null {
  if (tagName === 'doc-section') {
    const title = attributeOf(element, 'title');
    return title ? `sec-${slugify(title)}` : null;
  }
  if (tagName === 'doc-stage') {
    const title = attributeOf(element, 'title');
    return title ? `stage-${slugify(title)}` : null;
  }
  if (tagName === 'doc-choice' || tagName === 'doc-rating') {
    const question = attributeOf(element, 'question');
    return question ? slugify(question) : null;
  }
  return null;
}

export function validateHtml(source: string, options: ValidateOptions = {}): ValidationResult {
  const validator = new Validator(options);
  return validator.validate(source);
}

export function formatText(result: ValidationResult): string {
  if (result.ok && result.warningCount === 0) {
    return `${result.file}: ok`;
  }

  const lines: string[] = [];
  for (const diag of result.diagnostics) {
    lines.push(`${result.file}:${diag.line}:${diag.column}  ${diag.severity}  ${diag.ruleId}`);
    lines.push(`    ${diag.message}`);
    lines.push(`    fix: ${diag.fix}`);
  }

  const summary = `${result.errorCount} error${result.errorCount === 1 ? '' : 's'}, ${result.warningCount} warning${result.warningCount === 1 ? '' : 's'}`;
  lines.push('', summary);
  return lines.join('\n');
}

export function formatJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}
