/**
 * `<doc-mindmap title="…" expand="1" layout="tree">` — an interactive mind map.
 *
 * ```html
 * <doc-mindmap title="Account split" expand="1">
 *   <doc-node title="Database" icon="database" tone="green" open>
 *     <p>Three account tables, <strong>one per surface</strong>.</p>
 *     <doc-node title="customers"></doc-node>
 *     <doc-node title="vendor_users"></doc-node>
 *   </doc-node>
 *   <doc-node title="Server" icon="server" tone="blue">…</doc-node>
 * </doc-mindmap>
 * ```
 *
 * The title becomes the first card; every `doc-node` is a card of its own, and
 * nested nodes are its branches. Clicking a card with branches opens or closes
 * it, `expand` sets how deep the map starts open, and Expand all, Collapse all
 * and Fit sit in a toolbar. The map pans by dragging the background and zooms
 * with Ctrl+wheel or a pinch.
 *
 * why the cards are the author's own elements, positioned where they stand
 * (§2.2): a card's content is prose, and prose has to stay selectable,
 * commentable and findable with Ctrl+F. So nothing is copied and nothing is
 * moved. Each card is taken out of flow and translated to its place; a nested
 * card is positioned relative to the card it is written in, so a branch moves
 * with its parent for free. Only the title card, the toolbar and the branch
 * lines are chrome.
 *
 * why a closed branch is `hidden="until-found"` rather than removed from view
 * some other way: Ctrl+F still finds a word inside it, and `beforematch`
 * opens the path down to it — the same contract as every other disclosure
 * (`core/disclosure.ts`).
 *
 * Narrower than `OUTLINE_BELOW` the map is an indented outline instead: the
 * same cards, the same toggles, no pan and no sideways scroll. Print is the
 * outline with every branch open. Both are pure CSS over the states set here.
 *
 * Geometry lives in `core/mindmap.ts` and `core/arc.ts`; this file measures,
 * animates and handles input.
 */

import { arcBetween, arcPath, type Box, branchPath, type Point } from '../core/arc.js';
import { DocElement } from '../core/base.js';
import {
  boundsOf,
  centreView,
  fitZoom,
  type LayoutInput,
  layoutRadial,
  layoutTree,
  type MindmapLayout,
  mixBox,
  mixView,
  panToShow,
  parseExpand,
  type Size,
  startsOpen,
  type View,
  ZOOM_LIMITS,
  zoomAround,
} from '../core/mindmap.js';
import { createPart } from '../core/parts.js';
import { type DocNode, toggleText } from './doc-node.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ORIGIN_BOX: Box = { left: 0, top: 0, width: 0, height: 0 };

/** Below this width (the map's own, not the window's) the map is an outline. */
export const OUTLINE_BELOW = 640;

/** Length of an expand or collapse, and of a Fit. */
const MOTION_MS = 300;

/** Room kept clear around the cards when fitting, in pixels. */
const PADDING = 20;

/** The map's height range: at least this, at most this or 80% of the window. */
const MIN_HEIGHT = 280;
const MAX_HEIGHT = 760;

/** The first view may shrink a large map, but not below a size that reads. */
const FIRST_VIEW_MIN_ZOOM = 0.6;

/** How far a pointer travels before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

/** Things inside a card that a click belongs to, rather than to the card. */
const INTERACTIVE =
  'a[href], button, input, select, textarea, label, summary, audio, video, [contenteditable]';

/** One card in the map: a `doc-node`, or the title card the runtime drew. */
interface Item {
  readonly element: HTMLElement;
  readonly parent: Item | null;
  readonly children: Item[];
  /** 0 for the title card, 1 for its branches, and so on. */
  readonly level: number;
  /** The line from the parent's card; null for the title. */
  readonly link: SVGPathElement | null;
  open: boolean;
  /** Where the card is drawn now, in map coordinates; null until first placed. */
  shown: Box | null;
  opacity: number;
  /** Border widths: a nested card is positioned inside its parent's border. */
  inset: Point;
}

/** A card's place in one frame of an animation. */
interface Frame {
  readonly box: Box;
  readonly opacity: number;
}

/** Options for a relayout. */
interface LayoutOptions {
  readonly animate: boolean;
  /** The card the reader acted on: it stays where it is on screen. */
  readonly anchor?: Item;
  /** Fit the whole map afterwards, as Expand all and Collapse all do. */
  readonly fit?: boolean;
}

export class DocMindmap extends DocElement {
  #layout: MindmapLayout = 'tree';
  #mode: 'map' | 'outline' | null = null;
  #root: Item | null = null;
  #items: Item[] = [];
  readonly #byElement = new Map<Element, Item>();
  #view: View = { x: 0, y: 0, zoom: 1 };

  #rootCard: HTMLElement | null = null;
  #toolbar: HTMLElement | null = null;
  #links: SVGSVGElement | null = null;

  /** Bumped by every animation; a frame that sees a newer value stops. */
  #run = 0;
  #animating = false;
  /** A card changed size mid-animation; lay out again once it ends. */
  #stale = false;
  #refreshQueued = false;

  readonly #pointers = new Map<number, Point>();
  #pressStart: Point | null = null;
  #dragging = false;
  /** The press that just ended was a drag, so its click is not a toggle. */
  #suppressClick = false;

  #observers: { disconnect(): void }[] = [];

  protected enhance(): void {
    const title = this.attr('title', 'Mind map');
    this.internals.role = 'tree';
    this.internals.ariaLabel = title;
    this.#layout = this.attr('layout') === 'radial' ? 'radial' : 'tree';
    this.prepend(this.#buildToolbar(), this.#buildLinks(), this.#buildRootCard(title));

    // why deferred: `doc-mindmap` is registered before `doc-node`, so on a
    // delivered page its cards are still plain elements here. Their header,
    // toggle and ARIA come from their own upgrade, which has run by the time
    // this resolves.
    void customElements.whenDefined('doc-node').then(() => this.#start());
  }

  protected override teardown(): void {
    this.#run++;
    for (const observer of this.#observers) observer.disconnect();
    this.#observers = [];
  }

  // ── Building ────────────────────────────────────────────────────────────

  #buildToolbar(): HTMLElement {
    const toolbar = createPart('toolbar');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Mind map controls');
    const button = (part: string, text: string, action: () => void): HTMLButtonElement => {
      const element = createPart(part, 'button', { text }) as HTMLButtonElement;
      element.type = 'button';
      this.on(element, 'click', action);
      return element;
    };
    toolbar.append(
      button('expand-all', 'Expand all', () => this.#setAll(true)),
      button('collapse-all', 'Collapse all', () => this.#setAll(false)),
      button('fit', 'Fit', () => this.#fit(true, ZOOM_LIMITS.min)),
      createPart('hint', 'span', { text: 'Drag to pan · Ctrl + scroll to zoom' }),
    );
    this.#toolbar = toolbar;
    return toolbar;
  }

  #buildLinks(): SVGSVGElement {
    const links = document.createElementNS(SVG_NS, 'svg');
    links.dataset.part = 'links';
    links.dataset.docChrome = '';
    links.setAttribute('aria-hidden', 'true');
    this.#links = links;
    return links;
  }

  #buildRootCard(title: string): HTMLElement {
    const card = createPart('root');
    card.setAttribute('role', 'treeitem');
    card.setAttribute('aria-level', '1');
    card.setAttribute('aria-label', title);
    card.tabIndex = 0;
    const toggle = createPart('toggle', 'span');
    toggle.setAttribute('aria-hidden', 'true');
    card.append(toggle, createPart('root-title', 'span', { text: title }));
    this.#rootCard = card;
    return card;
  }

  /** Read the cards, then follow the map's width from here on. */
  #start(): void {
    if (!this.isConnected || !this.#rootCard || this.#root) return;
    const depth = parseExpand(this.getAttribute('expand'));
    const root = this.#addItem(this.#rootCard, null, depth > 0);
    this.#root = root;
    this.#collect(root, branchesOf(this), depth);
    for (const item of this.#items) this.#syncItem(item);

    this.#wireToggles();
    this.#wireKeys();
    this.#wirePanZoom();
    this.#watchSize();
  }

  #collect(parent: Item, elements: HTMLElement[], depth: number): void {
    for (const element of elements) {
      const level = parent.level + 1;
      const open = startsOpen(level, depth, {
        open: element.hasAttribute('open'),
        closed: element.hasAttribute('closed'),
      });
      const item = this.#addItem(element, parent, open);
      parent.children.push(item);
      this.#collect(item, branchesOf(element), depth);
    }
  }

  #addItem(element: HTMLElement, parent: Item | null, open: boolean): Item {
    const link = parent ? this.#addLink(element) : null;
    const item: Item = {
      element,
      parent,
      children: [],
      level: parent ? parent.level + 1 : 0,
      link,
      open,
      shown: null,
      opacity: parent ? 0 : 1,
      inset: { x: 0, y: 0 },
    };
    if (parent) element.tabIndex = -1;
    this.#items.push(item);
    this.#byElement.set(element, item);
    return item;
  }

  #addLink(element: HTMLElement): SVGPathElement {
    const path = document.createElementNS(SVG_NS, 'path');
    path.dataset.part = 'link';
    // A branch line takes the colour of the card it leads to, which may have
    // inherited its tone from further up.
    const tone = element.closest('doc-node[tone]')?.getAttribute('tone');
    if (tone) path.dataset.tone = tone;
    this.#links?.append(path);
    return path;
  }

  /** Reflect one card's open state and tree position onto its chrome and ARIA. */
  #syncItem(item: Item): void {
    const siblings = item.parent?.children ?? [item];
    const position = siblings.indexOf(item) + 1;
    if (isDocNode(item.element)) {
      item.element.setExpanded(item.open);
      item.element.setTreePosition(item.level + 1, position, siblings.length);
      return;
    }
    const branch = item.children.length > 0;
    if (branch) item.element.setAttribute('aria-expanded', String(item.open));
    const toggle = item.element.querySelector('[data-part="toggle"]');
    if (toggle) toggle.textContent = toggleText(branch, item.open, item.children.length);
  }

  // ── Modes and observers ─────────────────────────────────────────────────

  #watchSize(): void {
    if (typeof ResizeObserver !== 'function') {
      this.#setMode(this.clientWidth < OUTLINE_BELOW ? 'outline' : 'map');
      return;
    }
    // why the mode switch waits a frame: switching resizes the map, and a
    // resize inside its own observer's callback is the "ResizeObserver loop"
    // error. The frame still lands before the next paint.
    const host = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      if (width === 0) return;
      const mode = width < OUTLINE_BELOW ? 'outline' : 'map';
      if (mode === this.#mode) return;
      requestAnimationFrame(() => {
        if (mode !== this.#mode && this.isConnected) this.#setMode(mode);
      });
    });
    host.observe(this);

    // A card that changes size — an image arriving, a web font swapping in —
    // pushes its neighbours, so the map is laid out again.
    const cards = new ResizeObserver(() => this.#queueRefresh());
    for (const item of this.#items) cards.observe(item.element);
    this.#observers.push(host, cards);
  }

  #setMode(mode: 'map' | 'outline'): void {
    this.#mode = mode;
    this.#run++;
    this.#animating = false;
    this.setState('map', mode === 'map');
    this.setState('outline', mode === 'outline');
    this.#syncHidden();
    if (mode === 'outline') {
      this.style.removeProperty('--doc-mm-height');
      return;
    }
    this.#relayout({ animate: false });
    this.#fit(false, FIRST_VIEW_MIN_ZOOM);
  }

  /** Hide every card whose branch is closed, in place, so Ctrl+F still reaches it. */
  #syncHidden(): void {
    for (const item of this.#items) {
      if (item === this.#root) continue;
      if (this.#isVisible(item)) item.element.removeAttribute('hidden');
      else item.element.setAttribute('hidden', 'until-found');
    }
  }

  #queueRefresh(): void {
    if (this.#mode !== 'map' || this.#refreshQueued) return;
    this.#refreshQueued = true;
    requestAnimationFrame(() => {
      this.#refreshQueued = false;
      if (this.#animating) {
        this.#stale = true;
        return;
      }
      if (this.#sizesChanged()) this.#relayout({ animate: false });
    });
  }

  #sizesChanged(): boolean {
    return this.#visibleItems().some((item) => {
      const shown = item.shown;
      if (!shown) return true;
      return shown.width !== item.element.offsetWidth || shown.height !== item.element.offsetHeight;
    });
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  #isVisible(item: Item): boolean {
    for (let parent = item.parent; parent; parent = parent.parent) {
      if (!parent.open) return false;
    }
    return true;
  }

  /** Every card the reader can see, in reading (pre-) order. */
  #visibleItems(): Item[] {
    return this.#items.filter((item) => this.#isVisible(item));
  }

  /** Measure the visible cards and place them; boxes are in map coordinates. */
  #computeTargets(visible: readonly Item[]): Map<Item, Box> {
    const inputs = new Map<Item, LayoutInput>();
    const build = (item: Item): LayoutInput => {
      item.element.removeAttribute('hidden');
      item.inset = { x: item.element.clientLeft, y: item.element.clientTop };
      const input: LayoutInput = {
        width: item.element.offsetWidth,
        height: item.element.offsetHeight,
        children: item.open ? item.children.map(build) : [],
      };
      inputs.set(item, input);
      return input;
    };
    const root = this.#root;
    if (!root || visible.length === 0) return new Map();
    const boxes = (this.#layout === 'radial' ? layoutRadial : layoutTree)(build(root));

    const targets = new Map<Item, Box>();
    for (const [item, input] of inputs) {
      const box = boxes.get(input);
      if (box) targets.set(item, box);
    }
    return targets;
  }

  #relayout(options: LayoutOptions): void {
    if (this.#mode !== 'map' || !this.#root) return;
    this.#run++;
    const visible = this.#visibleItems();
    const targets = this.#computeTargets(visible);
    const from = new Map<Item, Frame>();
    const to = new Map<Item, Frame>();

    for (const item of this.#items) {
      const target = targets.get(item);
      const drawn = item.shown !== null && item.opacity > 0;
      if (!target && !drawn) {
        if (item !== this.#root) item.element.setAttribute('hidden', 'until-found');
        continue;
      }
      const start = drawn && item.shown ? item.shown : this.#collapsedInto(item, targets, 'shown');
      from.set(item, { box: start, opacity: drawn ? item.opacity : 0 });
      to.set(item, target ? { box: target, opacity: 1 } : this.#leaving(item, targets));
    }

    const view = options.fit
      ? this.#fittedView(targets, ZOOM_LIMITS.min)
      : this.#viewKeeping(options.anchor, targets);
    this.#animate(from, to, view, options.animate);
  }

  /**
   * Where a card sits while hidden: centred behind the nearest card that is
   * showing. A card opening grows out of where that card is now (`shown`); a
   * card closing shrinks into where that card is going (`target`).
   */
  #collapsedInto(item: Item, targets: Map<Item, Box>, prefer: 'shown' | 'target'): Box {
    let host = item.parent;
    while (host && !targets.has(host)) host = host.parent;
    const shown = host?.shown && host.opacity > 0 ? host.shown : undefined;
    const target = host ? targets.get(host) : undefined;
    const anchor = (prefer === 'shown' ? (shown ?? target) : (target ?? shown)) ?? ORIGIN_BOX;
    const width = item.shown?.width ?? item.element.offsetWidth;
    const height = item.shown?.height ?? item.element.offsetHeight;
    return {
      left: anchor.left + anchor.width / 2 - width / 2,
      top: anchor.top + anchor.height / 2 - height / 2,
      width,
      height,
    };
  }

  #leaving(item: Item, targets: Map<Item, Box>): Frame {
    return { box: this.#collapsedInto(item, targets, 'target'), opacity: 0 };
  }

  /**
   * Keep the card the reader acted on where it was on screen, then pan just
   * enough to bring its branches into view.
   */
  #viewKeeping(anchor: Item | undefined, targets: Map<Item, Box>): View {
    const before = anchor?.shown;
    const after = anchor ? targets.get(anchor) : undefined;
    let view = this.#view;
    if (anchor && before && after) {
      view = {
        x: view.x + (before.left - after.left) * view.zoom,
        y: view.y + (before.top - after.top) * view.zoom,
        zoom: view.zoom,
      };
    }
    const bounds = boundsOf(targets.values());
    const height = this.#setHeight(bounds, view.zoom);
    // A map that now fits at this zoom is brought wholly into view — closing
    // a branch shrinks the map, and must not leave the rest of it cut off.
    const fits =
      bounds.width * view.zoom <= this.clientWidth - PADDING * 2 &&
      bounds.height * view.zoom <= height - this.#toolbarHeight() - PADDING * 2;
    if (fits) view = this.#panToShow(view, bounds);
    if (!anchor || !after) return view;
    const branch = [after, ...anchor.children.flatMap((child) => targets.get(child) ?? [])];
    return this.#panToShow(view, boundsOf(branch));
  }

  /** The view that shows every visible card, sizing the map's height to it. */
  #fittedView(targets: Map<Item, Box>, minZoom: number): View {
    const bounds = boundsOf(targets.values());
    const top = this.#toolbarHeight();
    const room = { width: this.clientWidth, height: this.#maxHeight() - top };
    const zoom = fitZoom(bounds, room, PADDING, minZoom);
    const height = this.#setHeight(bounds, zoom);
    const view = centreView(bounds, { width: room.width, height: height - top }, PADDING, zoom);
    return { ...view, y: view.y + top };
  }

  #fit(animate: boolean, minZoom: number): void {
    if (this.#mode !== 'map') return;
    const targets = new Map<Item, Box>();
    for (const item of this.#visibleItems()) if (item.shown) targets.set(item, item.shown);
    const frames = new Map<Item, Frame>();
    for (const [item, box] of targets) frames.set(item, { box, opacity: 1 });
    this.#run++;
    this.#animate(frames, frames, this.#fittedView(targets, minZoom), animate);
  }

  #maxHeight(): number {
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, window.innerHeight * 0.8));
  }

  #toolbarHeight(): number {
    return (this.#toolbar?.offsetHeight ?? 0) + (this.#toolbar?.offsetTop ?? 0);
  }

  /** Size the map to its cards at `zoom`, within its range; returns the height. */
  #setHeight(bounds: Box, zoom: number): number {
    const wanted = bounds.height * zoom + PADDING * 2 + this.#toolbarHeight();
    const height = Math.round(Math.min(Math.max(wanted, MIN_HEIGHT), this.#maxHeight()));
    this.style.setProperty('--doc-mm-height', `${height}px`);
    return height;
  }

  #panToShow(view: View, box: Box): View {
    const top = this.#toolbarHeight();
    const height =
      Number.parseFloat(this.style.getPropertyValue('--doc-mm-height')) || this.clientHeight;
    const room: Size = { width: this.clientWidth, height: height - top };
    const shifted = panToShow({ ...view, y: view.y - top }, box, room, PADDING);
    return { ...shifted, y: shifted.y + top };
  }

  // ── Drawing ─────────────────────────────────────────────────────────────

  #animate(from: Map<Item, Frame>, to: Map<Item, Frame>, view: View, animate: boolean): void {
    const run = this.#run;
    const startView = this.#view;
    if (!animate || prefersReducedMotion()) {
      this.#draw(to, view);
      this.#settle(to, view);
      return;
    }
    // Draw the first frame now: a card just unhidden must not show for one
    // frame wherever it last stood.
    const first = new Map<Item, Frame>();
    for (const [item, end] of to) first.set(item, from.get(item) ?? end);
    this.#draw(first, startView);
    this.#animating = true;
    const started = performance.now();
    const step = (now: number): void => {
      if (run !== this.#run) return;
      const t = easeOut(Math.min((now - started) / MOTION_MS, 1));
      const frames = new Map<Item, Frame>();
      for (const [item, end] of to) frames.set(item, mixFrame(from.get(item) ?? end, end, t));
      this.#draw(frames, mixView(startView, view, t));
      if (t < 1) requestAnimationFrame(step);
      else this.#settle(to, view);
    };
    requestAnimationFrame(step);
  }

  /** Record where everything came to rest, and hide what closed. */
  #settle(frames: Map<Item, Frame>, view: View): void {
    this.#animating = false;
    this.#view = view;
    for (const [item, frame] of frames) {
      item.shown = frame.box;
      item.opacity = frame.opacity;
      if (frame.opacity === 0 && item !== this.#root) {
        item.element.setAttribute('hidden', 'until-found');
      }
    }
    if (this.#stale) {
      this.#stale = false;
      this.#queueRefresh();
    }
  }

  #draw(frames: Map<Item, Frame>, view: View): void {
    for (const [item, frame] of frames) {
      const parentBox = item.parent ? (frames.get(item.parent)?.box ?? item.parent.shown) : null;
      const offset = this.#offsetFor(item, frame.box, parentBox);
      item.element.style.setProperty('--doc-mm-x', `${round(offset.x)}px`);
      item.element.style.setProperty('--doc-mm-y', `${round(offset.y)}px`);
      item.element.style.setProperty('--doc-mm-opacity', String(round(frame.opacity)));
      // Recorded every frame, so an animation cut short by the next click
      // starts the next one from where the cards actually are.
      item.shown = frame.box;
      item.opacity = frame.opacity;
      if (item.link && parentBox) this.#drawLink(item.link, parentBox, frame);
    }
    this.#applyView(view);
  }

  /**
   * The translate a card needs. The title card and the top-level cards are
   * placed in the map itself; a nested card is placed inside its parent card,
   * so it is given its offset from that card's padding box.
   */
  #offsetFor(item: Item, box: Box, parentBox: Box | null): Point {
    const parent = item.parent;
    if (!parent || parent === this.#root || !parentBox) return { x: box.left, y: box.top };
    return {
      x: box.left - parentBox.left - parent.inset.x,
      y: box.top - parentBox.top - parent.inset.y,
    };
  }

  #drawLink(link: SVGPathElement, from: Box, frame: Frame): void {
    const d =
      this.#layout === 'radial'
        ? arcPath(arcBetween(from, frame.box))
        : branchPath(from, frame.box);
    link.setAttribute('d', d);
    link.style.opacity = String(round(frame.opacity));
  }

  #applyView(view: View): void {
    this.#view = view;
    this.style.setProperty('--doc-mm-pan-x', `${round(view.x)}px`);
    this.style.setProperty('--doc-mm-pan-y', `${round(view.y)}px`);
    this.style.setProperty('--doc-mm-zoom', String(Math.round(view.zoom * 1000) / 1000));
  }

  // ── Reader actions ──────────────────────────────────────────────────────

  #toggle(item: Item, open = !item.open): void {
    if (item.children.length === 0 || item.open === open) return;
    item.open = open;
    this.#syncItem(item);
    if (this.#mode === 'map') this.#relayout({ animate: true, anchor: item });
    else this.#syncHidden();
  }

  #setAll(open: boolean): void {
    for (const item of this.#items) {
      item.open = item === this.#root || open;
      this.#syncItem(item);
    }
    if (this.#mode === 'map') this.#relayout({ animate: true, fit: true });
    else this.#syncHidden();
  }

  #wireToggles(): void {
    this.on(this, 'click', (event: MouseEvent) => {
      if (this.#suppressClick) {
        this.#suppressClick = false;
        return;
      }
      const item = this.#itemAt(event.target);
      if (!item || item.children.length === 0) return;
      if (isInsideInteractive(event.target, item.element) || hasSelectionIn(item.element)) return;
      this.#toggle(item);
      this.#focus(item, false);
    });

    // Find-in-page landed inside a closed branch: open the path down to it.
    this.on(this, 'beforematch', (event: Event) => {
      const item = this.#itemAt(event.target);
      if (!item) return;
      for (let parent = item.parent; parent; parent = parent.parent) {
        parent.open = true;
        this.#syncItem(parent);
      }
      if (this.#mode !== 'map') return;
      this.#relayout({ animate: false });
      const box = item.shown;
      if (box) this.#applyView(this.#panToShow(this.#view, box));
    });
  }

  /** The card an event happened in, if it belongs to this map. */
  #itemAt(target: EventTarget | null): Item | null {
    if (!(target instanceof Element)) return null;
    const card = target.closest('doc-node, [data-part="root"]');
    return card ? (this.#byElement.get(card) ?? null) : null;
  }

  #wireKeys(): void {
    // However a card got focus — a click, Tab, a script — it becomes the
    // tree's tab stop, so Tab back into the map returns to it.
    this.on(this, 'focusin', (event: FocusEvent) => {
      const item = event.target instanceof Element ? this.#byElement.get(event.target) : undefined;
      if (item) this.#focus(item, false);
    });
    this.on(this, 'keydown', (event: KeyboardEvent) => {
      const item = event.target instanceof Element ? this.#byElement.get(event.target) : undefined;
      if (!item) return;
      const next = this.#keyTarget(item, event.key);
      if (next === undefined) return;
      event.preventDefault();
      if (next) this.#focus(next, true);
    });
  }

  /**
   * What a key does on a focused card (the WAI-ARIA tree pattern): returns the
   * card to move to, null when the key acted in place, undefined when the key
   * is not one the tree handles.
   */
  #keyTarget(item: Item, key: string): Item | null | undefined {
    const visible = this.#visibleItems();
    const index = visible.indexOf(item);
    const branch = item.children.length > 0;
    switch (key) {
      case 'ArrowDown':
        return visible[index + 1] ?? null;
      case 'ArrowUp':
        return visible[index - 1] ?? null;
      case 'Home':
        return visible[0] ?? null;
      case 'End':
        return visible.at(-1) ?? null;
      case 'ArrowRight':
        if (branch && !item.open) this.#toggle(item, true);
        return branch && item.open ? (item.children[0] ?? null) : null;
      case 'ArrowLeft':
        if (branch && item.open) this.#toggle(item, false);
        else return item.parent;
        return null;
      case 'Enter':
      case ' ':
        this.#toggle(item);
        return null;
      default:
        return undefined;
    }
  }

  /** Make `item` the tree's single tab stop, and optionally move focus to it. */
  #focus(item: Item, move: boolean): void {
    for (const other of this.#items) other.element.tabIndex = other === item ? 0 : -1;
    if (!move) return;
    item.element.focus({ preventScroll: this.#mode === 'map' });
    const box = item.shown;
    if (this.#mode === 'map' && box && !this.#animating) {
      this.#run++;
      const frames = new Map<Item, Frame>();
      this.#animate(frames, frames, this.#panToShow(this.#view, box), true);
    }
  }

  // ── Pan and zoom ────────────────────────────────────────────────────────

  #wirePanZoom(): void {
    this.on(this, 'pointerdown', (event: PointerEvent) => this.#pointerDown(event));
    this.on(this, 'pointermove', (event: PointerEvent) => this.#pointerMove(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      this.on(this, type, (event: PointerEvent) => this.#pointerUp(event));
    }
    this.on(this, 'wheel', (event: WheelEvent) => this.#wheel(event), { passive: false });
  }

  #pointerDown(event: PointerEvent): void {
    this.#suppressClick = false;
    if (this.#mode !== 'map') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!(event.target instanceof Element) || event.target.closest('[data-part="toolbar"]')) return;
    // A mouse press on a card is the start of a text selection, not a pan.
    const onCard = event.target.closest('doc-node, [data-part="root"]') !== null;
    if (onCard && event.pointerType === 'mouse') return;
    this.#pointers.set(event.pointerId, this.#localPoint(event));
    if (this.#pointers.size === 1) this.#pressStart = this.#localPoint(event);
  }

  #pointerMove(event: PointerEvent): void {
    const previous = this.#pointers.get(event.pointerId);
    if (!previous) return;
    const point = this.#localPoint(event);
    if (!this.#dragging) {
      const start = this.#pressStart ?? previous;
      if (Math.hypot(point.x - start.x, point.y - start.y) < DRAG_THRESHOLD) return;
      this.#beginDrag(event.pointerId);
    }
    if (this.#pointers.size >= 2) this.#pinch(event.pointerId, point);
    else
      this.#applyView({
        ...this.#view,
        x: this.#view.x + point.x - previous.x,
        y: this.#view.y + point.y - previous.y,
      });
    this.#pointers.set(event.pointerId, point);
  }

  #beginDrag(pointerId: number): void {
    this.#dragging = true;
    this.#run++;
    this.#animating = false;
    this.setState('panning', true);
    try {
      this.setPointerCapture(pointerId);
    } catch {
      // A pointer the browser no longer tracks cannot be captured; the drag
      // still follows the events that reach the map.
    }
  }

  /** Two fingers: zoom by the change in their spread, about their midpoint. */
  #pinch(pointerId: number, point: Point): void {
    const others = [...this.#pointers.entries()].filter(([id]) => id !== pointerId);
    const other = others[0]?.[1];
    const previous = this.#pointers.get(pointerId);
    if (!other || !previous) return;
    const before = Math.hypot(previous.x - other.x, previous.y - other.y) || 1;
    const after = Math.hypot(point.x - other.x, point.y - other.y) || 1;
    const middle = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
    this.#applyView(zoomAround(this.#view, after / before, middle));
  }

  #pointerUp(event: PointerEvent): void {
    if (!this.#pointers.delete(event.pointerId)) return;
    if (this.#pointers.size > 0) return;
    if (this.#dragging) this.#suppressClick = event.type === 'pointerup';
    this.#dragging = false;
    this.#pressStart = null;
    this.setState('panning', false);
  }

  /** Ctrl+wheel (and a trackpad pinch, which the browser reports as one) zooms. */
  #wheel(event: WheelEvent): void {
    if (this.#mode !== 'map' || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 0.05 : 0.002;
    this.#run++;
    this.#animating = false;
    this.#applyView(
      zoomAround(this.#view, Math.exp(-event.deltaY * scale), this.#localPoint(event)),
    );
  }

  /** A pointer position relative to the map's padding box. */
  #localPoint(event: MouseEvent): Point {
    const rect = this.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - this.clientLeft,
      y: event.clientY - rect.top - this.clientTop,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function branchesOf(element: Element): HTMLElement[] {
  return Array.from(element.children).filter(
    (child): child is HTMLElement => child.tagName === 'DOC-NODE',
  );
}

function isDocNode(element: HTMLElement): element is DocNode {
  return typeof (element as Partial<DocNode>).setExpanded === 'function';
}

function isInsideInteractive(target: EventTarget | null, card: Element): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest(INTERACTIVE);
  return control !== null && card.contains(control);
}

/** True while the reader has text selected inside `card` — the click ended a selection. */
function hasSelectionIn(card: Element): boolean {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed) return false;
  return card.contains(selection.anchorNode);
}

function mixFrame(from: Frame, to: Frame, t: number): Frame {
  return {
    box: mixBox(from.box, to.box, t),
    opacity: from.opacity + (to.opacity - from.opacity) * t,
  };
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
