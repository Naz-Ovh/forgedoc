/**
 * `<doc-custom title="…">` — the sanctioned escape hatch.
 *
 * For the one visual or interaction no built-in element explains well, the
 * author writes plain HTML here, with its own `<style>` and, if it needs one, a
 * `<script type="forgedoc">`:
 *
 * ```html
 * <doc-custom title="Cookie jar">
 *   <style>
 *     .jar { display: flex; gap: var(--doc-space-2); }
 *     .jar span { padding: var(--doc-space-1) var(--doc-space-3);
 *                 border-radius: var(--doc-radius-pill); background: var(--doc-accent-tint); }
 *   </style>
 *   <div class="jar"><span>ub_customer_session</span><span>ub_vendor_session</span></div>
 *   <script type="forgedoc">
 *     block.querySelector('.jar').addEventListener('click', () => { … });
 *   </script>
 * </doc-custom>
 * ```
 *
 * What the runtime guarantees, so the escape hatch is not a hole:
 *
 *   · **Styles stay inside.** Each `<style>` is wrapped in `@scope` (the build
 *     does it in the file; this element does it for anything unbuilt), so its
 *     rules reach only this block. No shadow root (§2.1) — the reader can still
 *     select and comment on the text.
 *   · **Scripts run once, late and private.** `type="forgedoc"` is not a type
 *     the browser executes, so the code waits for the runtime, runs after every
 *     element has upgraded, gets `block` (this element) and `reducedMotion`,
 *     and lives in its own function scope — two blocks can both declare
 *     `const items` without a collision. A throw is shown in the block rather
 *     than taking the page down.
 *   · **It is still a block.** `--doc-*` tokens inherit into it, so it follows
 *     the theme and dark mode, and it has the same comment button as a figure.
 *
 * Parts: `script-error`, `feedback`.
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart } from '../core/parts.js';
import { scopeCss } from '../core/scope-css.js';

/** The script type this element runs. Anything else is left to the browser. */
export const CUSTOM_SCRIPT_TYPE = 'forgedoc';

export class DocCustom extends DocElement {
  protected enhance(): void {
    const title = this.attr('title');
    this.internals.role = 'figure';
    if (title) this.internals.ariaLabel = title;

    for (const style of this.#own('style')) {
      const scoped = scopeCss(style.textContent ?? '');
      if (scoped !== style.textContent) style.textContent = scoped;
    }

    appendFeedbackButton(this, title, { icon: true });

    // why a microtask: elements are defined one tag at a time in `defineAll`, so
    // when this block upgrades, a `doc-flow` written inside it may not have yet.
    // Running after the current task means every element in the document has.
    queueMicrotask(() => this.#runScripts());
  }

  /** Elements of `tagName` that belong to this block rather than a nested one. */
  #own(tagName: string): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(tagName)).filter(
      (element) => element.closest('doc-custom') === this,
    );
  }

  #runScripts(): void {
    const reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (const script of this.#own('script')) {
      if (script.getAttribute('type')?.trim().toLowerCase() !== CUSTOM_SCRIPT_TYPE) continue;
      if (script.dataset.docRan !== undefined) continue;
      script.dataset.docRan = '';

      try {
        // why `new Function`: it is how an inline script gets its own scope and
        // named arguments. The code is the document author's own, exactly as
        // trusted as a plain `<script>` in the same file would be.
        const run = new Function('block', 'reducedMotion', script.textContent ?? '');
        run.call(this, this, reducedMotion);
      } catch (error) {
        this.#reportError(error);
      }
    }
  }

  #reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[forgedoc] doc-custom script failed:', error);
    this.findPart('script-error')?.remove();
    const notice = createPart('script-error', 'p', { text: `Script error: ${message}` });
    notice.setAttribute('role', 'alert');
    this.append(notice);
  }
}
