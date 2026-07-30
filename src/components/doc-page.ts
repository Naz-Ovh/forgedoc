/**
 * `<doc-page>` — the root, and the only authored root.
 *
 * Owns the single store (§9.1), the reading column, the TOC, the bucket mount
 * point and the print behaviour (§8.8).
 */

import { type BucketHandle, mountBucket } from '../bucket/mount.js';
import { DocElement } from '../core/base.js';
import { reportDevViolations } from '../core/dev-report.js';
import { indexFor } from '../core/numbering.js';
import { createPart } from '../core/parts.js';
import { storeFor } from '../core/store.js';
import type { DocStore } from '../core/types.js';

/** Viewport at or above which a docked rail has room for a column of its own. */
const TOC_DOCK_BREAKPOINT_PX = 1280;

export class DocPage extends DocElement {
  #bucket: BucketHandle | null = null;

  protected enhance(): void {
    // MUST (§5.4): stamp the version. When a reader pastes a bucket back into a
    // fresh session, this tells the agent which markup contract was in force.
    this.dataset.forgedoc = __FORGEDOC_VERSION__;

    this.#assignIds();
    this.#describeDocument();
    this.#warnWhenStorageUnavailable();
    this.#appendTableOfContents();
    this.#appendBucket();

    if (__FORGEDOC_DEV__) reportDevViolations(this);
  }

  protected override teardown(): void {
    this.#bucket?.destroy();
    this.#bucket = null;
  }

  /** The store for this document. Public so the bucket and tooling can reach it. */
  get docStore(): DocStore {
    return storeFor(this);
  }

  get docId(): string {
    return this.attr('doc-id', 'unnamed-plan');
  }

  /**
   * Write the derived ids onto the elements that own them.
   *
   * why here rather than in each component: ids are de-duplicated against the
   * whole document, so the numbering pass has to see every candidate before any
   * of them can be certain of its own id (§8.1).
   */
  #assignIds(): void {
    for (const [element, id] of indexFor(this).ids) {
      if (element.id === id) continue;
      element.id = id;
    }
  }

  /**
   * Label the document for assistive tech.
   *
   * why not a `heading` role on `doc-header` (§2.2): the title arrives as a
   * bare author text node beside the lede paragraph, and wrapping it would mean
   * moving author content. Naming the document from that text gives screen
   * reader users the title without touching the DOM the reader selects from.
   */
  #describeDocument(): void {
    this.internals.role = 'article';

    const header = this.querySelector('doc-header');
    const title = header?.getAttribute('data-title')?.trim();
    if (title) this.internals.ariaLabel = title;
  }

  /**
   * MUST (§9.3): when storage is blocked, say so loudly and permanently.
   *
   * Silent data loss on a feedback tool is the worst possible failure mode.
   */
  #warnWhenStorageUnavailable(): void {
    if (this.docStore.available) return;

    const banner = createPart('storage-warning');
    banner.setAttribute('role', 'status');
    banner.textContent =
      'Your answers won’t survive a reload — use Copy before closing. (This browser is blocking local storage for this file.)';
    this.prepend(banner);
  }

  /**
   * MUST NOT reparent (§8.1): the TOC is appended as a *sibling* of the author's
   * content, never as a wrapper around it. `doc-page > *` styles the reading
   * column directly and skips anything the runtime marked as chrome.
   */
  #appendTableOfContents(): void {
    if (this.attr('toc') === 'off') return;
    if (this.querySelector('doc-toc')) return;

    const toc = document.createElement('doc-toc');
    toc.dataset.part = 'toc';
    // MUST: chrome opts out of the reading column. Without this marker the
    // column rule `doc-page > *:not([data-doc-chrome])` matches the panel —
    // and it out-specifies `doc-toc`'s own `max-width`, so the collapsed panel
    // stretched to 90% of the viewport and covered the document behind it.
    toc.dataset.docChrome = '';
    this.append(toc);

    this.#applyTocState();
  }

  /**
   * Apply the author's pinned state, or the reader's remembered one.
   *
   * Default (§8.1 as amended): floating and collapsed, at every width.
   */
  #applyTocState(): void {
    const explicit = this.attr('toc');
    const preference =
      explicit === 'open' || explicit === 'closed' || explicit === 'docked'
        ? { open: explicit !== 'closed', docked: explicit === 'docked' }
        : this.docStore.get('toc');

    /*
     * why the viewport is consulted here and nowhere else: docking asks for a
     * column beside the content, and below the dock breakpoint there is no such
     * column — `toc.css` floats the panel instead. Honouring `docked` literally
     * would then open a full-height overlay across the first screen of the
     * document, which is precisely the failure the collapsed default exists to
     * avoid. It applies only to a *remembered or pinned* preference: the
     * reader's own toggles are never width-checked, because the dock control
     * does not exist below this width for them to press.
     */
    const roomToDock = window.matchMedia(`(min-width: ${TOC_DOCK_BREAKPOINT_PX}px)`).matches;
    if (preference.docked && !roomToDock) {
      this.#setToc(false, false, false);
      return;
    }

    this.#setToc(preference.open, preference.docked, false);
  }

  /**
   * Apply one contents-panel state, holding the invariant in one place.
   *
   * why the two flags are not independent: a docked-but-collapsed rail would
   * push the reading column aside to show a single word, and an undocked-but-
   * open rail is the floating overlay. So docking implies open, and collapsing
   * implies floating — every caller goes through here rather than reasoning
   * about the pair itself.
   *
   * why there is no width check here: whether a viewport is wide enough to give
   * a rail its own column is a *layout* question, and `toc.css` already answers
   * it — the docked rules and the dock control both live behind the same media
   * query. Asking the same question again in JavaScript would let the state and
   * the stylesheet disagree, and would freeze the answer at mount time on a
   * window the reader is free to resize.
   */
  #setToc(open: boolean, docked: boolean, persist: boolean): void {
    const resolvedOpen = open || docked;

    this.setState('toc-open', resolvedOpen);
    this.setState('toc-docked', docked);

    if (persist) this.docStore.set('toc', { open: resolvedOpen, docked });
  }

  /** True while the entry list is showing. Read by `doc-toc`'s own controls. */
  get tocOpen(): boolean {
    return this.hasState('toc-open');
  }

  /** True while the panel is pinned beside the reading column. */
  get tocDocked(): boolean {
    return this.hasState('toc-docked');
  }

  /** Expand or collapse the contents panel. Collapsing also undocks it. */
  toggleToc(force?: boolean): void {
    const open = force ?? !this.tocOpen;
    this.#setToc(open, open && this.tocDocked, true);
  }

  /** Pin the contents panel beside the content, or let it float. Docking opens it. */
  toggleTocDock(force?: boolean): void {
    this.#setToc(true, force ?? !this.tocDocked, true);
  }

  /**
   * The bucket mounts into a plain `<div>` appended here (§10.1).
   *
   * It is a Svelte component rather than a custom element because all of its DOM
   * is runtime-created — there is no author content to preserve, so §2.2 does
   * not apply, and no slots are needed.
   */
  #appendBucket(): void {
    const host = createPart('bucket');
    this.append(host);
    this.#bucket = mountBucket(host, this);
  }
}
