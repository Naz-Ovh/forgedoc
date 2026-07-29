/**
 * The in-page violation banner (§11.3).
 *
 * Dev builds only — every call site is guarded by `__PLANKIT_DEV__`, a literal
 * the bundler replaces, so the whole module is dead-code-eliminated from production
 * output.
 *
 * why a second, DOM-based checker instead of reusing `tools/validate.ts`: that
 * validator runs on raw HTML with parse5 to report real line numbers, and
 * bundling an HTML parser into the browser runtime to re-parse a document the
 * browser has already parsed would be absurd. This one walks the live DOM,
 * shares the same contract table and emits the same rule ids, and reports the
 * offending element instead of a line number.
 */

import { attributeSpec, GLOBAL_ATTRIBUTES, isKnownTag, TAGS, type TagSpec } from './contract.js';
import { createPart } from './parts.js';

interface DevViolation {
  readonly ruleId: string;
  readonly message: string;
  readonly element: Element;
}

/** Check the live document and, if anything is wrong, prepend a red banner. */
export function reportDevViolations(planDoc: HTMLElement): void {
  const violations = [
    ...checkTags(planDoc),
    ...checkChoices(planDoc),
    ...checkBlockers(planDoc),
    ...checkReferences(planDoc),
  ];
  if (violations.length === 0) return;

  planDoc.prepend(renderBanner(violations));
  for (const violation of violations) {
    console.warn(`[plankit] ${violation.ruleId}: ${violation.message}`, violation.element);
  }
}

function checkTags(planDoc: HTMLElement): DevViolation[] {
  const violations: DevViolation[] = [];

  for (const element of Array.from(planDoc.querySelectorAll('*'))) {
    const tagName = element.tagName.toLowerCase();
    if (!tagName.startsWith('plan-')) continue;

    if (!isKnownTag(tagName)) {
      violations.push({
        ruleId: 'tag/unknown',
        message: `Unknown tag <${tagName}>.`,
        element,
      });
      continue;
    }

    const spec = TAGS[tagName] as TagSpec;
    violations.push(...checkAttributes(element, tagName, spec));
  }

  return violations;
}

function checkAttributes(element: Element, tagName: string, spec: TagSpec): DevViolation[] {
  const violations: DevViolation[] = [];

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name;
    if (name.startsWith('data-') || name.startsWith('aria-') || name === 'role') continue;
    if (name === 'slot' || name === 'tabindex') continue;

    const definition = attributeSpec(tagName as keyof typeof TAGS, name);
    if (!definition) {
      violations.push({
        ruleId: 'attr/unknown',
        message: `<${tagName}> does not accept \`${name}\`. Allowed: ${Object.keys({
          ...spec.attributes,
          ...GLOBAL_ATTRIBUTES,
        }).join(', ')}.`,
        element,
      });
      continue;
    }

    if (definition.kind.type === 'enum' && !definition.kind.values.includes(attribute.value)) {
      violations.push({
        ruleId: 'attr/invalid-value',
        message: `\`${name}="${attribute.value}"\` on <${tagName}> must be one of: ${definition.kind.values.join(' | ')}.`,
        element,
      });
    }
  }

  for (const [name, definition] of Object.entries(spec.attributes)) {
    if (!definition.required || element.hasAttribute(name)) continue;
    violations.push({
      ruleId: 'attr/missing-required',
      message: `<${tagName}> requires \`${name}\`.`,
      element,
    });
  }

  return violations;
}

function checkChoices(planDoc: HTMLElement): DevViolation[] {
  return Array.from(planDoc.querySelectorAll('plan-choice'))
    .filter((choice) => authoredOptionCount(choice) < 2)
    .map((choice) => ({
      ruleId: 'choice/too-few-options',
      message: 'A <plan-choice> needs at least two <plan-option> children.',
      element: choice,
    }));
}

function authoredOptionCount(choice: Element): number {
  return Array.from(choice.querySelectorAll(':scope > plan-option')).filter(
    (option) => (option as HTMLElement).dataset.planChrome === undefined,
  ).length;
}

function checkBlockers(planDoc: HTMLElement): DevViolation[] {
  return Array.from(planDoc.querySelectorAll('plan-blocker'))
    .filter((blocker) => !blocker.querySelector('plan-action'))
    .map((blocker) => ({
      ruleId: 'child/missing-required',
      message:
        '<plan-blocker> has no <plan-action>. A roadblock without a resolution is exactly the failure this library prevents.',
      element: blocker,
    }));
}

function checkReferences(planDoc: HTMLElement): DevViolation[] {
  return Array.from(planDoc.querySelectorAll('plan-ref'))
    .filter((reference) => {
      const target = reference.getAttribute('to');
      return !target || !planDoc.querySelector(`#${CSS.escape(target)}`);
    })
    .map((reference) => ({
      ruleId: 'ref/unresolvable',
      message: `<plan-ref to="${reference.getAttribute('to') ?? ''}"> points at an id that does not exist.`,
      element: reference,
    }));
}

function renderBanner(violations: readonly DevViolation[]): HTMLElement {
  const banner = createPart('dev-banner');
  banner.setAttribute('role', 'alert');
  banner.append(
    createPart('dev-banner-title', 'strong', {
      text: `plankit dev — ${violations.length} contract violation${violations.length === 1 ? '' : 's'}`,
    }),
  );

  const list = document.createElement('ul');
  for (const violation of violations) {
    const item = document.createElement('li');
    item.textContent = `${violation.ruleId} — ${violation.message}`;
    list.append(item);
  }

  banner.append(list);
  return banner;
}
