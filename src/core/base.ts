/**
 * `PlanElement` — the base every component extends.
 *
 * Two constraints shape all of it:
 *
 *   §2.1  No shadow DOM. `attachInternals()` still works, and so do custom
 *         states, so nothing is lost. Selection, find-in-page and print all keep
 *         working because the reader's text is in the light DOM where the
 *         browser can see it.
 *
 *   §2.2  Enhance in place. `enhance()` may read children, append chrome, and
 *         set attributes. It may never move an author node — highlight restore
 *         runs immediately after mount and every live `Range` would be
 *         invalidated.
 */

import { partOf, partsOf } from './parts.js';
import { storeFor } from './store.js';
import type { PlanStore } from './types.js';

export abstract class PlanElement extends HTMLElement {
  /**
   * ARIA and form state live here, not in markup.
   *
   * why (§7.3): the authoring agent should never write `role=` or `aria-*`. It
   * writes meaning; the component translates that into accessibility.
   */
  protected readonly internals: ElementInternals = this.attachInternals();

  /** Aborted on disconnect; used for every listener attached outside this element. */
  #listeners: AbortController | undefined;

  connectedCallback(): void {
    // MUST (§7.2): guard against double-enhancement. The runtime gets re-run
    // during iteration and re-injected on rebuild, and double-appended letter
    // badges with duplicate listeners are miserable to debug.
    if (this.dataset.planUp !== undefined) return;
    this.dataset.planUp = '';

    this.#listeners = new AbortController();
    this.enhance();
  }

  disconnectedCallback(): void {
    this.#listeners?.abort();
    this.#listeners = undefined;
    this.teardown();
  }

  /**
   * Read children, append chrome, wire events. Never move author nodes.
   *
   * Keep this under ~40 lines (§12). If it grows, extract named private methods
   * that read as a sequence: `assignLetterKeys()`, `appendOtherOption()`,
   * `wireNoteToggle()`, `restoreAnswer()`.
   */
  protected abstract enhance(): void;

  /** Release observers and timers. Listeners registered with `on()` are automatic. */
  protected teardown(): void {}

  /** The first `[data-part="name"]` belonging to this component, not to a nested one. */
  protected findPart(name: string): HTMLElement | null {
    return partOf(this, name);
  }

  /** Every `[data-part="name"]` belonging to this component. */
  protected findParts(name: string): HTMLElement[] {
    return partsOf(this, name);
  }

  /**
   * Toggle a CSS custom state, targetable as `:state(name)`.
   *
   * why (§7.3): this keeps component state out of `class`, where an author's own
   * class name could collide with it — and unlike a class it is not something a
   * reader can accidentally clobber with devtools and then report as a bug.
   */
  protected setState(name: string, on: boolean): void {
    if (on) {
      this.internals.states.add(name);
      return;
    }
    this.internals.states.delete(name);
  }

  protected hasState(name: string): boolean {
    return this.internals.states.has(name);
  }

  /**
   * Add an event listener bound to this element's lifetime.
   *
   * Everything registered here is removed on disconnect, which matters for the
   * few components that listen on `document` or `window`.
   */
  protected on<K extends keyof DocumentEventMap>(
    target: EventTarget,
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  protected on(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void;
  protected on(
    target: EventTarget,
    type: string,
    handler: (event: never) => void,
    options: AddEventListenerOptions = {},
  ): void {
    target.addEventListener(type, handler as EventListener, {
      ...options,
      signal: this.#listeners?.signal,
    });
  }

  /** The owning `plan-doc`, or null if this element is used outside one. */
  protected planDoc(): HTMLElement | null {
    return this.closest('plan-doc');
  }

  /**
   * The single store for this document (§9.1).
   *
   * Components MUST NOT reach for `localStorage` directly — one read on mount
   * and one debounced write on change, for the whole document.
   */
  protected store(): PlanStore | null {
    const planDoc = this.planDoc();
    if (!planDoc) return null;
    return storeFor(planDoc);
  }

  /** Trimmed attribute value, or `fallback` when absent or blank. */
  protected attr(name: string, fallback = ''): string {
    return this.getAttribute(name)?.trim() || fallback;
  }

  /** Presence test for boolean attributes such as `open` or `recommended`. */
  protected flag(name: string): boolean {
    return this.hasAttribute(name);
  }
}
