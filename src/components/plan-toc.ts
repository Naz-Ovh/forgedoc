/**
 * `<plan-toc>` — generated, never authored.
 *
 * The validator errors if this tag appears in source markup (§8.1). `plan-doc`
 * creates one and appends it as a *sibling* of the reading column, so the
 * author's content is never wrapped.
 */

import { PlanElement } from '../core/base.js';
import { indexFor, type OutlineEntry } from '../core/numbering.js';
import { createPart } from '../core/parts.js';
import type { PlanDoc } from './plan-doc.js';

/** How far down the viewport a heading counts as "current" for scroll-spy. */
const SPY_ROOT_MARGIN = '-72px 0px -70% 0px';

export class PlanToc extends PlanElement {
  #spy: IntersectionObserver | undefined;
  readonly #linksBySectionId = new Map<string, HTMLAnchorElement>();

  protected enhance(): void {
    const planDoc = this.planDoc() as PlanDoc | null;
    if (!planDoc) return;

    this.internals.role = 'navigation';
    this.internals.ariaLabel = 'Contents';

    const outline = indexFor(planDoc).outline;
    if (outline.length === 0) {
      this.hidden = true;
      return;
    }

    this.#appendHeader(planDoc);
    this.#appendEntries(outline, planDoc);
    this.#startScrollSpy(outline);
    this.#closeOnEscape(planDoc);
  }

  protected override teardown(): void {
    this.#spy?.disconnect();
    this.#spy = undefined;
  }

  /** The header row: expand/collapse on the left, float/dock on the right. */
  #appendHeader(planDoc: PlanDoc): void {
    const header = createPart('header', 'div');

    const toggle = createPart('toggle', 'button');
    toggle.setAttribute('type', 'button');
    toggle.textContent = 'Contents';
    this.on(toggle, 'click', () => {
      planDoc.toggleToc();
      this.#reflect(planDoc);
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
      planDoc.toggleTocDock();
      this.#reflect(planDoc);
    });

    header.append(toggle, dock);
    this.append(header);
    this.#reflect(planDoc);
  }

  /** Mirror the document's TOC state onto the two controls. */
  #reflect(planDoc: PlanDoc): void {
    this.findPart('toggle')?.setAttribute('aria-expanded', String(planDoc.tocOpen));

    const dock = this.findPart('dock');
    if (!dock) return;
    dock.setAttribute('aria-pressed', String(planDoc.tocDocked));
    dock.setAttribute(
      'aria-label',
      planDoc.tocDocked ? 'Float the contents panel' : 'Dock the contents panel',
    );
    dock.title = planDoc.tocDocked ? 'Float over the document' : 'Dock beside the document';
  }

  /**
   * Escape collapses a floating panel.
   *
   * why only when floating: docked, the panel is part of the layout rather than
   * something covering the reader's document, so Escape has nothing to dismiss.
   */
  #closeOnEscape(planDoc: PlanDoc): void {
    this.on(document, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!planDoc.tocOpen || planDoc.tocDocked) return;
      planDoc.toggleToc(false);
      this.#reflect(planDoc);
    });
  }

  #appendEntries(outline: readonly OutlineEntry[], planDoc: PlanDoc): void {
    const list = createPart('list', 'ol');

    for (const entry of outline) {
      const item = document.createElement('li');
      item.dataset.depth = String(entry.depth);

      const link = document.createElement('a');
      link.dataset.part = 'entry';
      link.dataset.planChrome = '';
      link.href = `#${entry.id}`;
      link.append(
        createPart('entry-number', 'span', { text: entry.number }),
        createPart('entry-title', 'span', { text: entry.title }),
      );

      this.#linksBySectionId.set(entry.id, link);
      item.append(link);
      list.append(item);
    }

    // A floating panel is covering the section it just scrolled to, so get out
    // of the way. A docked one is not in the way, so it stays.
    this.on(list, 'click', (event) => {
      if (!(event.target as Element | null)?.closest('[data-part="entry"]')) return;
      if (planDoc.tocDocked) return;
      planDoc.toggleToc(false);
      this.#reflect(planDoc);
    });

    this.append(list);
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
