/**
 * `<doc-option>` — one answer inside a `<doc-choice>`.
 *
 * ```html
 * <doc-option recommended>
 *   Yes — shared team inbox
 *   <p slot="desc">"Unread" means nobody handled it yet. Simplest.</p>
 * </doc-option>
 * ```
 *
 * MUST (§8.4): the label text stays a direct author text node. The bucket
 * serialises labels verbatim so a pasted bucket is self-contained in a fresh
 * session, and restructuring the text into generated markup would break that.
 *
 * **Never `disabled`.** A disabled option cannot be read by assistive tech and
 * cannot be selected for feedback. `recommended` is the way to emphasise one.
 */

import { DocElement } from '../core/base.js';
import { createPart } from '../core/parts.js';

export interface OptionSetup {
  /** Derived letter key: `A`, `B`, … or `O` for the appended Other. */
  readonly key: string;
  /** Shared radio group name, or the checkbox name in multi mode. */
  readonly name: string;
  readonly mode: 'single' | 'multi';
  /**
   * Called whenever any control in the group changes.
   *
   * why no `(key, checked)` payload: selecting a radio silently unchecks its
   * sibling without firing `change` on it, so the only trustworthy answer is to
   * re-read every input in the group.
   */
  readonly onChange: () => void;
}

/**
 * Add the control and letter badge to an option, in place.
 *
 * Exported as a function rather than a method so `doc-choice` can call it
 * without depending on whether `doc-option` has upgraded yet — custom element
 * upgrade order follows `customElements.define` order, which is not something a
 * component should have to reason about.
 */
export function setupOption(option: HTMLElement, setup: OptionSetup): HTMLInputElement {
  const existing = option.querySelector<HTMLInputElement>(':scope > [data-part="control"] input');
  if (existing) return existing;

  const control = createPart('control', 'label');

  const input = document.createElement('input');
  input.type = setup.mode === 'single' ? 'radio' : 'checkbox';
  input.name = setup.name;
  input.value = optionValue(option, setup.key);
  input.dataset.part = 'input';
  input.dataset.docChrome = '';
  // why an explicit label rather than wrapping the text: the accessible name has
  // to come from the author's text node without moving it (§2.2, §8.4).
  input.setAttribute('aria-label', optionLabel(option));

  const badge = createPart('key', 'span', { text: setup.key });
  badge.setAttribute('aria-hidden', 'true');

  control.append(input, badge);
  option.prepend(control);

  option.dataset.key = setup.key;
  markDescription(option, input);
  appendRecommendedBadge(option);

  input.addEventListener('change', () => setup.onChange());

  // The whole row is a hit target, not just the little circle.
  option.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, a, button')) {
      return;
    }
    input.checked = setup.mode === 'single' ? true : !input.checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  return input;
}

/** The value persisted for this option: the author's override, or the letter key. */
export function optionValue(option: HTMLElement, key: string): string {
  return option.getAttribute('value')?.trim() || key;
}

/**
 * The option's label text, read verbatim from the DOM.
 *
 * Excludes the `slot="desc"` paragraph and any chrome, so what the bucket
 * serialises is exactly the sentence the author wrote.
 */
export function optionLabel(option: HTMLElement): string {
  const parts: string[] = [];

  for (const node of Array.from(option.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    if (node.dataset.docChrome !== undefined) continue;
    if (node.getAttribute('slot') === 'desc') continue;
    parts.push(node.textContent ?? '');
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Name the `slot="desc"` paragraph and wire it to the control as a description.
 *
 * `slot` is a plain selector hook here, not a shadow slot (§8.1) — the paragraph
 * stays exactly where the author put it.
 */
function markDescription(option: HTMLElement, input: HTMLInputElement): void {
  const description = option.querySelector<HTMLElement>(':scope > [slot="desc"]');
  if (!description) return;

  description.dataset.part = 'desc';
  if (!description.id) description.id = `${input.name}-${input.value}-desc`;
  input.setAttribute('aria-describedby', description.id);
}

function appendRecommendedBadge(option: HTMLElement): void {
  if (!option.hasAttribute('recommended')) return;
  if (option.querySelector(':scope > [data-part="recommended"]')) return;

  option.append(createPart('recommended', 'span', { text: 'Recommended' }));
}

/**
 * The element itself does almost nothing — `doc-choice` owns the group, because
 * letter keys, the shared radio name and restore-from-store are all decisions
 * that only make sense across the whole set of options.
 *
 * why no ARIA role here: the generated `<input>` already carries the option's
 * accessible name and description. Giving the wrapper a role as well would make
 * assistive tech announce the same sentence twice.
 */
export class DocOption extends DocElement {
  protected enhance(): void {
    // `doc-choice` calls setupOption() for every option it owns, including the
    // appended Other. Nothing to do here; the guard in DocElement keeps a
    // second upgrade from duplicating anything.
  }
}
