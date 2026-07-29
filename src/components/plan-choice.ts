/**
 * `<plan-choice>` — the most important interactive component.
 *
 * The agent writes a question and two or more answers. Everything else — letter
 * keys, the Other option and its textarea, the note field, the sequence label,
 * the id and the ARIA — is a runtime default (§8.4).
 *
 * ```html
 * <plan-choice mode="single" question="Should read state be shared?">
 *   <plan-option recommended>Yes — shared team inbox<p slot="desc">Simplest.</p></plan-option>
 *   <plan-option>No — per-person read state<p slot="desc">Needs an extra table.</p></plan-option>
 * </plan-choice>
 * ```
 */

import { PlanElement } from '../core/base.js';
import { OTHER_KEY, optionKeys } from '../core/numbering.js';
import { authorChildren, createPart } from '../core/parts.js';
import { questionId } from '../core/slug.js';
import type { StoredAnswer } from '../core/types.js';
import { optionLabel, optionValue, setupOption } from './plan-option.js';

type ChoiceMode = 'single' | 'multi';

export class PlanChoice extends PlanElement {
  #inputs: HTMLInputElement[] = [];
  #otherText: HTMLTextAreaElement | null = null;
  #note: HTMLTextAreaElement | null = null;

  protected enhance(): void {
    if (!this.id) this.id = questionId(this.attr('question'));

    this.#applyAria();
    this.#prependSequenceLabel();
    this.#prependQuestion();
    this.#assignLetterKeys();
    this.#appendOtherOption();
    this.#wireNoteToggle();
    this.#restoreAnswer();
  }

  get mode(): ChoiceMode {
    return this.attr('mode', 'single') === 'multi' ? 'multi' : 'single';
  }

  get questionText(): string {
    return this.attr('question');
  }

  /** MUST (§7.3): ARIA comes from `ElementInternals`, never from authored markup. */
  #applyAria(): void {
    this.internals.role = this.mode === 'single' ? 'radiogroup' : 'group';
    this.internals.ariaLabel = this.questionText;
  }

  /** `QUESTION 3 · SINGLE CHOICE` — position derived from document order. */
  #prependSequenceLabel(): void {
    const planDoc = this.planDoc();
    const siblings = planDoc ? Array.from(planDoc.querySelectorAll('plan-choice')) : [this];
    const position = siblings.indexOf(this) + 1;
    const modeLabel = this.mode === 'single' ? 'SINGLE CHOICE' : 'MULTIPLE CHOICE';

    // Published so `plan-ref to="q-…"` can render "Question 3" without repeating
    // the walk, and so print styles can show the number when chrome is hidden.
    this.dataset.number = String(position);
    this.prepend(createPart('sequence', 'div', { text: `QUESTION ${position} · ${modeLabel}` }));
  }

  /**
   * Render the question as visible text.
   *
   * The author wrote it as an attribute, so this is chrome built from scratch —
   * nothing is moved. It goes after the sequence label, which was prepended
   * first, hence `insertBefore` against the first author child.
   */
  #prependQuestion(): void {
    const question = createPart('question', 'div', { text: this.questionText });
    const sequence = this.findPart('sequence');
    if (sequence) {
      sequence.after(question);
      return;
    }
    this.prepend(question);
  }

  /** Letter keys `A`, `B`, `C`… in document order, skipping the reserved `O`. */
  #assignLetterKeys(): void {
    const options = this.#authorOptions();
    const keys = optionKeys(options.length);

    this.#inputs = options.map((option, index) =>
      setupOption(option, {
        key: keys[index] ?? OTHER_KEY,
        name: `${this.id}-answer`,
        mode: this.mode,
        onChange: () => this.#persistAnswer(),
      }),
    );
  }

  #authorOptions(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(':scope > plan-option')).filter(
      (option) => option.dataset.planChrome === undefined,
    );
  }

  /**
   * Append the Other option (§8.4).
   *
   * MUST: the textarea lives *inside* the Other block so it reads as part of
   * that choice — never as a stray field below the list. It stays hidden until
   * Other is the selected answer.
   */
  #appendOtherOption(): void {
    if (this.querySelector(':scope > plan-option[data-part="other"]')) return;

    const other = document.createElement('plan-option');
    other.dataset.part = 'other';
    other.dataset.planChrome = '';
    other.append(
      createPart('other-label', 'span', { text: 'Other — type your own solution' }),
      createPart('other-hint', 'span', { text: 'anything the options above miss' }),
    );

    const textarea = createTextarea(
      'other-text',
      'Describe the answer you would rather give…',
      `${this.id}-other`,
    );
    other.append(textarea);
    this.append(other);

    const input = setupOption(other, {
      key: OTHER_KEY,
      name: `${this.id}-answer`,
      mode: this.mode,
      onChange: () => this.#persistAnswer(),
    });

    this.#inputs.push(input);
    this.#otherText = textarea;
    this.on(textarea, 'input', () => this.#persistAnswer());
  }

  /**
   * The note field (§8.4): a comment *on the chosen answer*, behind a small
   * toggle so it never competes with the options for attention.
   */
  #wireNoteToggle(): void {
    if (this.findPart('note-toggle')) return;

    const toggle = createPart('note-toggle', 'button');
    toggle.setAttribute('type', 'button');
    toggle.textContent = '＋ Add a note';
    toggle.setAttribute('aria-expanded', 'false');

    const note = createTextarea(
      'note',
      'Anything to add about this answer? This is a comment, not a second answer.',
      `${this.id}-note`,
    );

    this.append(toggle, note);
    this.#note = note;

    this.on(toggle, 'click', () => this.#setNoteOpen(!this.hasState('note-open')));
    this.on(note, 'input', () => this.#persistAnswer());
    this.#setNoteOpen(false);
  }

  #setNoteOpen(open: boolean): void {
    this.setState('note-open', open);
    this.findPart('note-toggle')?.setAttribute('aria-expanded', String(open));
    if (open) this.#note?.focus();
  }

  /** Read every control in the group and write one answer record to the store. */
  #persistAnswer(): void {
    const store = this.store();
    if (!store) return;

    const keys = this.#inputs.filter((input) => input.checked).map((input) => input.value);
    const answer: StoredAnswer = { keys };

    const otherText = this.#otherText?.value.trim();
    if (otherText) answer.otherText = otherText;

    const note = this.#note?.value.trim();
    if (note) answer.note = note;

    store.set('answers', { ...store.get('answers'), [this.id]: answer });
    this.#reflectSelection();
  }

  /** Restore a persisted answer, including revealing fields that hold text. */
  #restoreAnswer(): void {
    const stored = this.store()?.get('answers')[this.id];
    if (!stored) {
      this.#reflectSelection();
      return;
    }

    for (const input of this.#inputs) {
      input.checked = stored.keys.includes(input.value);
    }
    if (this.#otherText && stored.otherText) this.#otherText.value = stored.otherText;
    if (this.#note && stored.note) {
      this.#note.value = stored.note;
      // MUST (§8.4): auto-reveal on load when the field holds restored text,
      // otherwise the reader's own comment is invisible until they go looking.
      this.#setNoteOpen(true);
    }

    this.#reflectSelection();
  }

  /** Mirror the current selection into custom states so CSS can react. */
  #reflectSelection(): void {
    const answered = this.#inputs.some((input) => input.checked);
    this.setState('answered', answered);

    for (const input of this.#inputs) {
      const option = input.closest('plan-option');
      option?.toggleAttribute('data-selected', input.checked);
    }

    const otherChecked = this.#inputs.some((input) => input.checked && input.value === OTHER_KEY);
    this.setState('other-open', otherChecked);
    if (otherChecked) this.#otherText?.focus();
  }

  /** The answer as stored, for the bucket serialiser. */
  currentAnswer(): StoredAnswer | undefined {
    return this.store()?.get('answers')[this.id];
  }

  /** Human-readable labels for the selected keys, read verbatim from the DOM. */
  labelsForKeys(keys: readonly string[]): string[] {
    const labels: string[] = [];

    for (const option of Array.from(this.querySelectorAll<HTMLElement>(':scope > plan-option'))) {
      const key = option.dataset.key ?? '';
      if (!keys.includes(optionValue(option, key))) continue;

      // An Other answer serialises the reader's typed text as the answer label
      // (§10.3), so a pasted bucket is self-contained.
      if (option.dataset.part === 'other') {
        labels.push(this.#otherText?.value.trim() || 'Other (no text given)');
        continue;
      }
      labels.push(optionLabel(option));
    }

    return labels;
  }
}

/**
 * MUST (§8.4): every free-text field in a question is a `<textarea>`, never a
 * single-line `<input>`, and they all share one visual style. A reader typing a
 * paragraph into a one-line box is a bad enough experience to lose the answer.
 */
function createTextarea(part: string, placeholder: string, id: string): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.dataset.part = part;
  textarea.dataset.planChrome = '';
  textarea.placeholder = placeholder;
  textarea.rows = 3;
  textarea.id = id;
  textarea.setAttribute('aria-label', placeholder);
  return textarea;
}

/** Options an author wrote, ignoring the appended Other. Used by tests. */
export function authorOptionsOf(choice: PlanChoice): HTMLElement[] {
  return authorChildren(choice).filter((child) => child.tagName.toLowerCase() === 'plan-option');
}
