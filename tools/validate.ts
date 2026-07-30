/**
 * The markup contract validator.
 *
 * Built before any component, because it *is* the contract: a `forgedoc build`
 * that fails loudly gives the authoring agent a feedback loop it can close on
 * its own — write, build, read errors, fix, rebuild (§11.1).
 *
 * MUST (§11.2): this file runs in Node against raw HTML and MUST NOT import the
 * browser runtime. It imports only `src/core/contract.ts` and `src/core/slug.ts`,
 * both of which are pure data and pure string functions.
 */

import { type DefaultTreeAdapterTypes, parse } from 'parse5';

import {
  type AttributeSpec,
  attributeSpec,
  GLOBAL_ATTRIBUTES,
  isKnownTag,
  TAGS,
  type TagName,
  type TagSpec,
} from '../src/core/contract.js';
import {
  collapseId,
  type IdCandidate,
  questionId,
  resolveIds,
  sectionId,
  slugify,
  stageId,
} from '../src/core/slug.js';

type Element = DefaultTreeAdapterTypes.Element;
type Node = DefaultTreeAdapterTypes.Node;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;

export type Severity = 'error' | 'warning';

/** One machine-parseable finding. Shape is stable and covered by semver. */
export interface Diagnostic {
  readonly severity: Severity;
  /** Stable identifier, e.g. `choice/too-few-options`. */
  readonly ruleId: string;
  readonly message: string;
  /** A concrete edit that resolves the finding. */
  readonly fix: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export interface ValidationResult {
  readonly file: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly ok: boolean;
}

export interface ValidateOptions {
  /** Path reported in diagnostics. */
  readonly file?: string;
  /**
   * True when the file is supposed to have been through `forgedoc build`, which
   * turns a surviving `@DOC_CSS@` / `@DOC_JS@` placeholder into an error.
   */
  readonly expectBuilt?: boolean;
}

const CSS_PLACEHOLDER = '/*@DOC_CSS@*/';
const JS_PLACEHOLDER = '//@DOC_JS@';

/** `doc-id`, section ids and `doc-ref to` targets must all look like this. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Maximum `doc-section` nesting depth before the validator warns (§8.1). */
const MAX_SECTION_DEPTH = 3;

/** Validate a plan document. Never throws — malformed HTML still yields findings. */
export function validateHtml(html: string, options: ValidateOptions = {}): ValidationResult {
  const file = options.file ?? '<input>';
  const document = parse(html, { sourceCodeLocationInfo: true });
  const collector = new DiagnosticCollector(file, html);

  const walker = new DocumentWalker(collector);
  walker.walk(document);
  walker.finish();

  checkPlaceholders(html, collector, options.expectBuilt === true);

  return collector.result();
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

interface Position {
  readonly line: number;
  readonly column: number;
}

const START_OF_FILE: Position = { line: 1, column: 1 };

class DiagnosticCollector {
  readonly #diagnostics: Diagnostic[] = [];

  constructor(
    private readonly file: string,
    private readonly source: string,
  ) {}

  error(ruleId: string, message: string, fix: string, at: Position): void {
    this.#diagnostics.push({ severity: 'error', ruleId, message, fix, file: this.file, ...at });
  }

  warn(ruleId: string, message: string, fix: string, at: Position): void {
    this.#diagnostics.push({ severity: 'warning', ruleId, message, fix, file: this.file, ...at });
  }

  /** Locate a literal substring in the raw source, for findings with no element. */
  positionOf(needle: string): Position {
    const offset = this.source.indexOf(needle);
    if (offset < 0) return START_OF_FILE;

    const before = this.source.slice(0, offset);
    const line = before.split('\n').length;
    const lastNewline = before.lastIndexOf('\n');
    return { line, column: offset - lastNewline };
  }

  result(): ValidationResult {
    const sorted = [...this.#diagnostics].sort(
      (a, b) => a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId),
    );
    const errorCount = sorted.filter((d) => d.severity === 'error').length;
    return {
      file: this.file,
      diagnostics: sorted,
      errorCount,
      warningCount: sorted.length - errorCount,
      ok: errorCount === 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree walking
// ─────────────────────────────────────────────────────────────────────────────

const isElement = (node: Node): node is Element => 'tagName' in node;

const hasChildren = (node: Node): node is ParentNode => 'childNodes' in node;

const attributeOf = (element: Element, name: string): string | null =>
  element.attrs.find((attr) => attr.name === name)?.value ?? null;

const hasAttribute = (element: Element, name: string): boolean =>
  element.attrs.some((attr) => attr.name === name);

/** Position of an element's start tag, or of one of its attributes. */
function positionOf(element: Element, attribute?: string): Position {
  const location = element.sourceCodeLocation;
  if (!location) return START_OF_FILE;

  if (attribute) {
    const attributeLocation = location.attrs?.[attribute];
    if (attributeLocation) {
      return { line: attributeLocation.startLine, column: attributeLocation.startCol };
    }
  }
  return { line: location.startLine, column: location.startCol };
}

const childElements = (node: ParentNode): Element[] => node.childNodes.filter(isElement);

/** All descendant elements with the given tag name, at any depth. */
function descendantsNamed(node: ParentNode, tagName: string): Element[] {
  const found: Element[] = [];
  for (const child of childElements(node)) {
    if (child.tagName === tagName) found.push(child);
    found.push(...descendantsNamed(child, tagName));
  }
  return found;
}

/** Nearest ancestor that is a `doc-*` element, using an explicit ancestor stack. */
function nearestPlanAncestor(ancestors: readonly Element[]): Element | null {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const candidate = ancestors[index];
    if (candidate?.tagName.startsWith('doc-')) return candidate;
  }
  return null;
}

/**
 * Single pass over the document, gathering everything the cross-element rules
 * need (ids, refs, section depths) while emitting the per-element findings.
 */
class DocumentWalker {
  readonly #planDocs: Element[] = [];
  readonly #idCandidates: IdCandidate[] = [];
  readonly #idOwners: Element[] = [];
  readonly #references: { element: Element; target: string }[] = [];
  readonly #sectionSlugs = new Map<string, Element[]>();
  #choiceCount = 0;
  /** Populated by `#checkIds`, read by `#checkReferences`. */
  #resolvedIds = new Set<string>();

  constructor(private readonly collector: DiagnosticCollector) {}

  walk(node: Node, ancestors: Element[] = []): void {
    if (isElement(node)) {
      this.#visitElement(node, ancestors);
    }
    if (!hasChildren(node)) return;

    const nextAncestors = isElement(node) ? [...ancestors, node] : ancestors;
    for (const child of node.childNodes) {
      this.walk(child, nextAncestors);
    }
  }

  /** Rules that need the whole document: ids, refs, and "exactly one doc-page". */
  finish(): void {
    this.#checkDocumentRoot();
    this.#checkIds();
    this.#checkReferences();
    this.#checkDuplicateSectionSlugs();
    this.#checkDocumentHasQuestions();
  }

  #visitElement(element: Element, ancestors: Element[]): void {
    const tagName = element.tagName;
    if (!tagName.startsWith('doc-')) return;

    if (!isKnownTag(tagName)) {
      this.collector.error(
        'tag/unknown',
        `Unknown tag <${tagName}>.`,
        `Check the spelling against skills/better-plan/CHEATSHEET.md. ${nearestTagSuggestion(tagName)}`,
        positionOf(element),
      );
      return;
    }

    const spec = TAGS[tagName] as TagSpec;
    this.#checkGenerated(element, tagName, spec);
    this.#checkAttributes(element, tagName, spec);
    this.#checkPlacement(element, tagName, spec, ancestors);
    this.#checkRequiredChildren(element, tagName, spec);
    this.#collectIdentity(element, tagName, ancestors);
    this.#checkTagSpecificRules(element, tagName, ancestors);
  }

  #checkGenerated(element: Element, tagName: TagName, spec: TagSpec): void {
    if (!spec.generated) return;
    this.collector.error(
      'toc/authored',
      `<${tagName}> is generated by the runtime and must not be written by hand.`,
      `Delete the <${tagName}> block. The runtime builds it from the doc-section tree at mount.`,
      positionOf(element),
    );
  }

  #checkAttributes(element: Element, tagName: TagName, spec: TagSpec): void {
    for (const attribute of element.attrs) {
      if (attribute.name.startsWith('data-')) continue;

      const attributeName = attribute.name;
      const attributeDefinition = attributeSpec(tagName, attributeName);
      if (!attributeDefinition) {
        this.collector.error(
          'attr/unknown',
          `<${tagName}> does not accept the attribute \`${attributeName}\`.`,
          `Remove it, or use one of: ${Object.keys({ ...spec.attributes, ...GLOBAL_ATTRIBUTES }).join(', ')}.`,
          positionOf(element, attributeName),
        );
        continue;
      }

      if (attributeName === 'style') {
        this.collector.warn(
          'attr/inline-style',
          `Inline \`style\` on <${tagName}>.`,
          'This works, but a preset attribute or a `--doc-*` token override is usually what you want (§6.6).',
          positionOf(element, attributeName),
        );
      }

      this.#checkAttributeValue(
        element,
        tagName,
        attributeName,
        attribute.value,
        attributeDefinition,
      );
    }

    for (const [name, definition] of Object.entries(spec.attributes)) {
      if (!definition.required) continue;
      if (hasAttribute(element, name)) continue;
      // `doc/missing-doc-id` reports this one with a far better fix message.
      if (tagName === 'doc-page' && name === 'doc-id') continue;

      this.collector.error(
        'attr/missing-required',
        `<${tagName}> requires the attribute \`${name}\`.`,
        `Add ${name}="…" — ${definition.doc}`,
        positionOf(element),
      );
    }
  }

  #checkAttributeValue(
    element: Element,
    tagName: TagName,
    name: string,
    value: string,
    definition: AttributeSpec,
  ): void {
    const at = positionOf(element, name);
    const kind = definition.kind;

    if (kind.type === 'enum' && !kind.values.includes(value)) {
      const ruleId = name === 'lang' ? 'code/unknown-lang' : 'attr/invalid-value';
      this.collector.error(
        ruleId,
        `\`${name}="${value}"\` is not valid on <${tagName}>.`,
        `Use one of: ${kind.values.join(' | ')}.`,
        at,
      );
      return;
    }

    if (kind.type === 'slug' && value !== '' && !SLUG_PATTERN.test(value)) {
      this.collector.error(
        'attr/invalid-value',
        `\`${name}="${value}"\` is not a slug.`,
        `Use lowercase letters, digits and hyphens, e.g. ${name}="${slugify(value)}".`,
        at,
      );
      return;
    }

    if (kind.type === 'integer' && !/^-?\d+$/.test(value)) {
      this.collector.error(
        'attr/invalid-value',
        `\`${name}="${value}"\` is not a whole number.`,
        `Use a whole number, e.g. ${name}="0".`,
        at,
      );
      return;
    }

    const requiresText = kind.type === 'string' || kind.type === 'url' || kind.type === 'token';
    if (requiresText && definition.required && value.trim() === '') {
      this.collector.error(
        'attr/invalid-value',
        `\`${name}\` on <${tagName}> is empty.`,
        `Give it a value — ${definition.doc}`,
        at,
      );
    }
  }

  #checkPlacement(element: Element, tagName: TagName, spec: TagSpec, ancestors: Element[]): void {
    if (!spec.onlyInside) return;

    const parent = nearestPlanAncestor(ancestors);
    if (parent && spec.onlyInside.includes(parent.tagName)) return;

    const allowed = spec.onlyInside.map((name) => `<${name}>`).join(' or ');
    this.collector.error(
      'child/misplaced',
      `<${tagName}> is only valid inside ${allowed}${parent ? `, but its nearest plan ancestor is <${parent.tagName}>` : ''}.`,
      `Move the <${tagName}> block inside a ${allowed}.`,
      positionOf(element),
    );
  }

  #checkRequiredChildren(element: Element, tagName: TagName, spec: TagSpec): void {
    if (!spec.requiresChild) return;

    for (const requiredChild of spec.requiresChild) {
      if (descendantsNamed(element, requiredChild).length > 0) continue;

      this.collector.error(
        'child/missing-required',
        `<${tagName}> requires a <${requiredChild}> child.`,
        requiredChildFix(tagName, requiredChild),
        positionOf(element),
      );
    }
  }

  /** Record this element's id — explicit or derived — for the duplicate and ref checks. */
  #collectIdentity(element: Element, tagName: TagName, ancestors: Element[]): void {
    const derivedId = derivedIdFor(element, tagName);
    if (!derivedId) return;

    this.#idCandidates.push({ explicitId: attributeOf(element, 'id'), derivedId });
    this.#idOwners.push(element);

    if (tagName === 'doc-section') {
      const existing = this.#sectionSlugs.get(derivedId) ?? [];
      existing.push(element);
      this.#sectionSlugs.set(derivedId, existing);
      this.#checkSectionDepth(element, ancestors);
    }
  }

  #checkSectionDepth(element: Element, ancestors: Element[]): void {
    const depth = ancestors.filter((a) => a.tagName === 'doc-section').length + 1;
    if (depth <= MAX_SECTION_DEPTH) return;

    this.collector.warn(
      'section/too-deep',
      `<doc-section> is nested ${depth} levels deep; the vocabulary supports ${MAX_SECTION_DEPTH}.`,
      'Flatten the outline, or promote this content into its own top-level section.',
      positionOf(element),
    );
  }

  #checkTagSpecificRules(element: Element, tagName: TagName, ancestors: Element[]): void {
    if (tagName === 'doc-page') {
      this.#planDocs.push(element);
      if (ancestors.some((a) => a.tagName === 'doc-page')) {
        this.collector.error(
          'doc/duplicate',
          '<doc-page> is nested inside another <doc-page>.',
          'Exactly one <doc-page> per document. Remove the inner one.',
          positionOf(element),
        );
      }
      return;
    }

    if (tagName === 'doc-choice') {
      this.#choiceCount += 1;
      const options = descendantsNamed(element, 'doc-option');
      if (options.length > 0 && options.length < 2) {
        this.collector.error(
          'choice/too-few-options',
          `<doc-choice> has ${options.length} <doc-option> child; it needs at least 2.`,
          'Add a second <doc-option>. The runtime appends "Other" on top of yours — it does not count.',
          positionOf(element),
        );
      }
      return;
    }

    if (tagName === 'doc-ref') {
      const target = attributeOf(element, 'to');
      if (target) this.#references.push({ element, target });
      return;
    }

    if (tagName === 'doc-figure') {
      const hasCaptionAttribute = (attributeOf(element, 'caption') ?? '').trim() !== '';
      const hasCaptionChild = descendantsNamed(element, 'doc-caption').length > 0;
      if (!hasCaptionAttribute && !hasCaptionChild) {
        this.collector.warn(
          'figure/missing-caption',
          '<doc-figure> has no caption.',
          'Add caption="…", or a <doc-caption> child for a rich caption.',
          positionOf(element),
        );
      }
    }
  }

  #checkDocumentRoot(): void {
    if (this.#planDocs.length === 0) {
      this.collector.error(
        'doc/missing',
        'No <doc-page> found.',
        'Wrap the document in <doc-page doc-id="your-doc-slug">…</doc-page>.',
        START_OF_FILE,
      );
      return;
    }

    for (const duplicate of this.#planDocs.slice(1)) {
      this.collector.error(
        'doc/duplicate',
        'More than one <doc-page> in the file.',
        'Exactly one <doc-page> per document — it owns the store, the layout and the bucket.',
        positionOf(duplicate),
      );
    }

    for (const docPage of this.#planDocs) {
      const docId = attributeOf(docPage, 'doc-id');
      if (docId !== null && docId.trim() !== '') continue;

      this.collector.error(
        'doc/missing-doc-id',
        '<doc-page> has no `doc-id`.',
        // why (§9.3): Chrome has historically shared one localStorage bucket
        // across all file:// documents, so two plans would see each other.
        'Add doc-id="a-unique-slug". Every storage key is namespaced with it, which is what stops two plans opened from file:// colliding.',
        positionOf(docPage),
      );
    }
  }

  #checkIds(): void {
    const resolved = resolveIds(this.#idCandidates);
    const seen = new Map<string, number>();

    resolved.forEach((id, index) => {
      const firstIndex = seen.get(id);
      if (firstIndex === undefined) {
        seen.set(id, index);
        return;
      }

      const owner = this.#idOwners[index];
      if (!owner) return;
      this.collector.error(
        'id/duplicate',
        `Duplicate id \`${id}\`.`,
        'Ids are derived from titles and questions. Change the title, or set an explicit id="…" on one of them.',
        positionOf(owner, hasAttribute(owner, 'id') ? 'id' : undefined),
      );
    });

    this.#resolvedIds = new Set(resolved);
  }

  #checkReferences(): void {
    for (const { element, target } of this.#references) {
      if (this.#resolvedIds.has(target)) continue;

      this.collector.error(
        'ref/unresolvable',
        `<doc-ref to="${target}"> points at an id that does not exist.`,
        `Ids are derived: a section titled "X" becomes ${sectionId('X')}, a question becomes ${questionId('X')}, a stage becomes ${stageId('X')}. Known ids: ${[...this.#resolvedIds].slice(0, 8).join(', ') || '(none)'}.`,
        positionOf(element, 'to'),
      );
    }
  }

  #checkDuplicateSectionSlugs(): void {
    for (const [slug, elements] of this.#sectionSlugs) {
      if (elements.length < 2) continue;

      for (const duplicate of elements.slice(1)) {
        this.collector.warn(
          'section/duplicate-slug',
          `Two sections slugify to \`${slug}\`; this one gets a numeric suffix.`,
          'Two sections with the same title is a content smell. Give them distinct titles so their anchors stay meaningful.',
          positionOf(duplicate, 'title'),
        );
      }
    }
  }

  #checkDocumentHasQuestions(): void {
    if (this.#choiceCount > 0) return;
    if (this.#planDocs.length === 0) return;

    const docPage = this.#planDocs[0];
    if (!docPage) return;
    this.collector.warn(
      'doc/no-choice',
      'The document contains no <doc-choice>.',
      'A plan with no questions collects no feedback. Add at least one <doc-choice> for the decisions you are unsure about.',
      positionOf(docPage),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The id the runtime would derive for this element, or null if it needs none.
 *
 * Elements outside the switch only enter the id namespace when the author gave
 * them one explicitly — they still have to be checked for duplicates.
 */
function derivedIdFor(element: Element, tagName: TagName): string | null {
  switch (tagName) {
    case 'doc-section':
      return sectionId(attributeOf(element, 'title') ?? '');
    case 'doc-choice':
      return questionId(attributeOf(element, 'question') ?? '');
    case 'doc-stage':
      return stageId(attributeOf(element, 'title') ?? '');
    case 'doc-collapse':
      return collapseId(attributeOf(element, 'title') ?? '');
    default:
      return attributeOf(element, 'id');
  }
}

function requiredChildFix(tagName: TagName, requiredChild: string): string {
  if (tagName === 'doc-blocker' && requiredChild === 'doc-action') {
    // why (§8.3): this is the single rule the component exists to enforce.
    return 'Add <doc-action>…</doc-action> stating what resolves the roadblock. A roadblock with no resolution is exactly the failure this library exists to prevent.';
  }
  if (tagName === 'doc-table' && requiredChild === 'table') {
    return 'Put a plain <table> inside <doc-table>. The component styles it; it does not generate it.';
  }
  return `Add at least one <${requiredChild}> inside the <${tagName}>.`;
}

/** Cheap "did you mean" for a misspelled tag, by shared-prefix length. */
function nearestTagSuggestion(tagName: string): string {
  let best = '';
  let bestScore = 0;

  for (const candidate of Object.keys(TAGS)) {
    let score = 0;
    while (
      score < candidate.length &&
      score < tagName.length &&
      candidate[score] === tagName[score]
    ) {
      score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  // 'doc-' alone is 5 characters and tells the reader nothing.
  if (bestScore <= 5) return '';
  return `Did you mean <${best}>?`;
}

function checkPlaceholders(
  html: string,
  collector: DiagnosticCollector,
  expectBuilt: boolean,
): void {
  if (!expectBuilt) return;

  for (const placeholder of [CSS_PLACEHOLDER, JS_PLACEHOLDER]) {
    if (!html.includes(placeholder)) continue;

    collector.error(
      'build/unreplaced-placeholder',
      `The built file still contains \`${placeholder}\`.`,
      'Injection did not run, or ran against the wrong file. Re-run `forgedoc build <file.html>`.',
      collector.positionOf(placeholder),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable report: one line per finding, plus an indented fix. */
export function formatText(result: ValidationResult): string {
  if (result.diagnostics.length === 0) {
    return `${result.file}: ok`;
  }

  const lines = result.diagnostics.map((diagnostic) => {
    const location = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`;
    return `${location}  ${diagnostic.severity}  ${diagnostic.ruleId}\n    ${diagnostic.message}\n    fix: ${diagnostic.fix}`;
  });

  lines.push(
    `\n${result.errorCount} error${result.errorCount === 1 ? '' : 's'}, ` +
      `${result.warningCount} warning${result.warningCount === 1 ? '' : 's'}`,
  );
  return lines.join('\n');
}

/** Machine-readable report for an agent harness (`--format=json`). */
export function formatJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}
