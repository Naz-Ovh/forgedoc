/**
 * `<doc-toc>` — generated, never authored.
 *
 * The validator errors if this tag appears in source markup (§8.1). `doc-page`
 * creates one and appends it as a *sibling* of the reading column, so the
 * author's content is never wrapped.
 */

import { DocElement } from '../core/base.js';
import { indexFor, type OutlineEntry } from '../core/numbering.js';
import { menuIcon, questionIcon } from '../core/icons.js';
import { createPart } from '../core/parts.js';
import { hasQuestions, QUESTIONS_OPEN_EVENT, unansweredBySection } from '../questions/model.js';
import type { DocState } from '../core/types.js';
import type { DocPage } from './doc-page.js';

/** How far down the viewport a heading counts as "current" for scroll-spy. */
const SPY_ROOT_MARGIN = '-72px 0px -70% 0px';

export class DocToc extends DocElement {
  #spy: IntersectionObserver | undefined;
  #unsubscribe: (() => void) | undefined;
  #state: DocState | undefined;
  readonly #linksBySectionId = new Map<string, HTMLAnchorElement>();

  protected enhance(): void {
    const docPage = this.docPage() as DocPage | null;
    if (!docPage) return;

    this.internals.role = 'navigation';
    this.internals.ariaLabel = 'Contents';

    const outline = indexFor(docPage).outline;
    const questions = hasQuestions(docPage);

    // why the question check joins the emptiness test: the panel's other job is
    // now to be the way into the question list, and a document with questions
    // but no sections would otherwise hide the only trigger there is.
    if (outline.length === 0 && !questions) {
      this.hidden = true;
      return;
    }

    this.#appendHeader(docPage, questions);
    this.#appendEntries(outline, docPage);
    this.#startScrollSpy(outline);
    this.#closeOnEscape(docPage);
    this.#trackQuestions(docPage);
  }

  protected override teardown(): void {
    this.#spy?.disconnect();
    this.#spy = undefined;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  /** The header row: expand/collapse, the question list, float/dock. */
  #appendHeader(docPage: DocPage, questions: boolean): void {
    const header = createPart('header', 'div');

    const toggle = createPart('toggle', 'button');
    toggle.setAttribute('type', 'button');
    toggle.append(menuIcon(), createPart('toggle-text', 'span', { text: 'Contents' }));
    this.on(toggle, 'click', () => {
      docPage.toggleToc();
      this.#reflect(docPage);
    });

    /*
     * Floating covers the document; docked pushes it aside. Neither is right for
     * everyone, and the reader is the only one who knows how wide their window
     * is — so this is a control rather than a breakpoint. It is offered only
     * where docking is possible; below the dock breakpoint `toggleTocDock` would
     * resolve straight back to floating, and a control that does nothing is
     * worse than no control.
     */
    const dock = createPart('dock', 'button');
    dock.setAttribute('type', 'button');
    this.on(dock, 'click', () => {
      docPage.toggleTocDock();
      this.#reflect(docPage);
    });

    header.append(toggle);
    if (questions) header.append(this.#createQuestionsTrigger(docPage));
    header.append(dock);

    this.append(header);
    this.#reflect(docPage);
  }

  /**
   * The way into the question list.
   *
   * why it lives here rather than beside the feedback trigger: this panel is
   * already the answer to "where am I in this document", and "which parts of it
   * still want something from me" is the same question asked about the same
   * outline. It carries the number still open so a reader knows whether it is
   * worth pressing before they press it.
   */
  #createQuestionsTrigger(docPage: DocPage): HTMLElement {
    const button = createPart('questions', 'button');
    button.setAttribute('type', 'button');
    button.setAttribute('aria-haspopup', 'dialog');
    button.append(questionIcon(), createPart('questions-count', 'span'));

    this.on(button, 'click', () => {
      docPage.dispatchEvent(new CustomEvent(QUESTIONS_OPEN_EVENT, { bubbles: true }));
    });

    return button;
  }

  /** Mirror the document's TOC state onto the two controls. */
  #reflect(docPage: DocPage): void {
    this.findPart('toggle')?.setAttribute('aria-expanded', String(docPage.tocOpen));

    const dock = this.findPart('dock');
    if (!dock) return;
    dock.setAttribute('aria-pressed', String(docPage.tocDocked));
    dock.setAttribute(
      'aria-label',
      docPage.tocDocked ? 'Float the contents panel' : 'Dock the contents panel',
    );
    dock.title = docPage.tocDocked ? 'Float over the document' : 'Dock beside the document';
  }

  /**
   * Escape collapses a floating panel.
   *
   * why only when floating: docked, the panel is part of the layout rather than
   * something covering the reader's document, so Escape has nothing to dismiss.
   */
  #closeOnEscape(docPage: DocPage): void {
    this.on(document, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!docPage.tocOpen || docPage.tocDocked) return;
      docPage.toggleToc(false);
      this.#reflect(docPage);
    });
  }

  #appendEntries(outline: readonly OutlineEntry[], docPage: DocPage): void {
    const list = createPart('list', 'ol');

    for (const entry of outline) {
      const item = document.createElement('li');
      item.dataset.depth = String(entry.depth);

      const link = document.createElement('a');
      link.dataset.part = 'entry';
      link.dataset.docChrome = '';
      link.href = `#${entry.id}`;
      link.append(
        createPart('entry-number', 'span', { text: entry.number }),
        createPart('entry-title', 'span', { text: entry.title }),
        // Filled in by `#trackQuestions`, hidden while the count is zero.
        createPart('entry-questions', 'span'),
      );

      this.#linksBySectionId.set(entry.id, link);
      item.append(link);
      list.append(item);
    }

    // A floating panel is covering the section it just scrolled to, so get out
    // of the way. A docked one is not in the way, so it stays.
    this.on(list, 'click', (event) => {
      if (!(event.target as Element | null)?.closest('[data-part="entry"]')) return;
      if (docPage.tocDocked) return;
      docPage.toggleToc(false);
      this.#reflect(docPage);
    });

    this.append(list);
  }

  /**
   * Mark which sections still have something to answer.
   *
   * why the panel and not the document: "it is very hard to find which section
   * has questions" is a navigation problem, and this is the navigation. A reader
   * scanning the outline can now see where the open decisions are without
   * scrolling past the prose between them, and the count falls as they answer.
   */
  #trackQuestions(docPage: DocPage): void {
    const store = this.store();
    if (!store) return;

    this.#unsubscribe = store.subscribe((state) => {
      this.#state = state;
      this.#refreshQuestions(docPage);
    });

    /*
     * Once more after the document has finished upgrading.
     *
     * why: this panel is created from inside `doc-page`'s own `enhance()`, so
     * it runs *before* the elements it is counting. `doc-choice` gets its id
     * from the numbering pass and is already resolvable, but `doc-rating`
     * assigns its own — which has not happened yet, so a restored rating reads
     * as unanswered on the first pass. A microtask lands after the whole tree
     * has upgraded and before the reader can see either number.
     */
    queueMicrotask(() => this.#refreshQuestions(docPage));
  }

  #refreshQuestions(docPage: DocPage): void {
    const state = this.#state;
    if (!state) return;

    const bySection = unansweredBySection(docPage, state.answers);
    let total = 0;

    for (const [id, link] of this.#linksBySectionId) {
      const count = bySection.get(id) ?? 0;
      total += count;
      this.#markEntry(link, count);
    }

    // A question outside any section still counts towards the trigger, so the
    // badge is the document's total rather than the sum of the entries above.
    for (const [id, count] of bySection) {
      if (!this.#linksBySectionId.has(id)) total += count;
    }

    this.#markTrigger(total);
  }

  #markEntry(link: HTMLAnchorElement, count: number): void {
    const marker = link.querySelector<HTMLElement>('[data-part="entry-questions"]');
    if (!marker) return;

    marker.textContent = count > 0 ? String(count) : '';
    marker.hidden = count === 0;
    marker.title = count === 1 ? '1 question unanswered' : `${count} questions unanswered`;
    link.toggleAttribute('data-has-questions', count > 0);
  }

  #markTrigger(total: number): void {
    const button = this.findPart('questions');
    if (!button) return;

    const count = button.querySelector<HTMLElement>('[data-part="questions-count"]');
    if (count) {
      count.textContent = total > 0 ? String(total) : '';
      count.hidden = total === 0;
    }

    button.dataset.state = total > 0 ? 'open' : 'done';
    const label =
      total === 0
        ? 'Open the question list — every question is answered'
        : `Open the question list — ${total} unanswered`;
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  /**
   * Highlight the section the reader is looking at.
   *
   * why `IntersectionObserver` rather than a scroll listener: it costs nothing
   * when the page is still, and a 300-section plan would otherwise run a layout
   * read on every scroll frame.
   */
  #startScrollSpy(outline: readonly OutlineEntry[]): void {
    if (typeof IntersectionObserver !== 'function') return;

    this.#spy = new IntersectionObserver(
      (entries) => {
        for (const observed of entries) {
          if (!observed.isIntersecting) continue;
          this.#markCurrent(observed.target.id);
        }
      },
      { rootMargin: SPY_ROOT_MARGIN, threshold: 0 },
    );

    for (const entry of outline) this.#spy.observe(entry.element);
  }

  #markCurrent(sectionId: string): void {
    for (const [id, link] of this.#linksBySectionId) {
      const isCurrent = id === sectionId;
      if (isCurrent) {
        link.setAttribute('aria-current', 'true');
        continue;
      }
      link.removeAttribute('aria-current');
    }
  }
}
