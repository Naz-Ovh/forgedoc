/**
 * Geometry for `doc-mindmap`: where each visible card goes, and the view that
 * shows them.
 *
 * Pure numbers in, numbers out, the same arrangement as `arc.ts`: no DOM, so
 * the layouts are testable in Node and identical in every theme. The element
 * measures its cards, hands their sizes here, and draws what comes back.
 *
 * Coordinates are the map's own, unscaled: a card's box is where it sits
 * before the reader's pan and zoom (`View`) are applied.
 */

import type { Box, Point } from './arc.js';

/** A card to place: its measured size and the cards branching off it. */
export interface LayoutInput {
  readonly width: number;
  readonly height: number;
  readonly children: readonly LayoutInput[];
}

/** The two arrangements an author can ask for with `layout`. */
export type MindmapLayout = 'tree' | 'radial';

/** The reader's pan and zoom: map point `p` is drawn at `p × zoom + (x, y)`. */
export interface View {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** A width and height, for the visible part of the map. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Smallest and largest zoom a reader can reach. */
export const ZOOM_LIMITS = { min: 0.3, max: 2 } as const;

/** Gap between a card and its children's column, and between sibling branches. */
const TREE_GAP_X = 56;
const TREE_GAP_Y = 14;

/** Gap between rings in the radial layout, and between neighbours on a ring. */
const RING_GAP = 40;
const RING_SPACING = 18;

/**
 * Parse `expand`: how many levels below the title start open.
 *
 * `none` is 0 (only the title shows), a number is that many levels, `all` is
 * every level. Anything else falls back to the default of 1, the same value an
 * absent attribute gets — the validator reports the typo, the reader still
 * gets a map.
 */
export function parseExpand(value: string | null): number {
  const trimmed = value?.trim().toLowerCase() ?? '';
  if (trimmed === 'all') return Number.POSITIVE_INFINITY;
  if (trimmed === 'none') return 0;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return 1;
}

/** True when `value` is something `expand` accepts: `all`, `none` or a whole number. */
export function isValidExpand(value: string): boolean {
  return /^(all|none|\d+)$/.test(value.trim());
}

/**
 * Whether a card at `level` starts open. The title is level 0, its children
 * level 1. A card's own `open` or `closed` beats the map's `expand`.
 */
export function startsOpen(
  level: number,
  expandDepth: number,
  flags: { readonly open: boolean; readonly closed: boolean },
): boolean {
  if (flags.closed) return false;
  if (flags.open) return true;
  return level < expandDepth;
}

/**
 * Left-to-right tree: each card is centred on the column of its children, and
 * sibling branches stack without overlapping.
 *
 * The title's box starts at the origin; every other box follows from it.
 */
export function layoutTree(root: LayoutInput): Map<LayoutInput, Box> {
  const spans = new Map<LayoutInput, number>();
  const spanOf = (node: LayoutInput): number => {
    const known = spans.get(node);
    if (known !== undefined) return known;
    const span = Math.max(node.height, childrenSpan(node, spanOf));
    spans.set(node, span);
    return span;
  };

  const boxes = new Map<LayoutInput, Box>();
  const place = (node: LayoutInput, left: number, top: number): void => {
    const span = spanOf(node);
    boxes.set(node, {
      left,
      top: top + (span - node.height) / 2,
      width: node.width,
      height: node.height,
    });
    let y = top + (span - childrenSpan(node, spanOf)) / 2;
    for (const child of node.children) {
      place(child, left + node.width + TREE_GAP_X, y);
      y += spanOf(child) + TREE_GAP_Y;
    }
  };
  place(root, 0, 0);
  return boxes;
}

/** Height of a card's children stacked with the sibling gap between them. */
function childrenSpan(node: LayoutInput, spanOf: (node: LayoutInput) => number): number {
  if (node.children.length === 0) return 0;
  const total = node.children.reduce((sum, child) => sum + spanOf(child), 0);
  return total + TREE_GAP_Y * (node.children.length - 1);
}

/**
 * Radial: the title in the middle, each level on a ring around it, and each
 * branch given a slice of the circle in proportion to how many leaves it has.
 *
 * Suited to a small map. With many cards a ring has to grow very wide to hold
 * them side by side, which is what the tree layout avoids.
 */
export function layoutRadial(root: LayoutInput): Map<LayoutInput, Box> {
  const leaves = new Map<LayoutInput, number>();
  const leavesOf = (node: LayoutInput): number => {
    const known = leaves.get(node);
    if (known !== undefined) return known;
    const count = node.children.reduce((sum, child) => sum + leavesOf(child), 0) || 1;
    leaves.set(node, count);
    return count;
  };

  const radii = ringRadii(root);
  const boxes = new Map<LayoutInput, Box>();
  boxes.set(root, centredBox(root, { x: 0, y: 0 }));

  const place = (node: LayoutInput, depth: number, from: number, to: number): void => {
    let start = from;
    for (const child of node.children) {
      const sweep = ((to - from) * leavesOf(child)) / leavesOf(node);
      const angle = start + sweep / 2;
      const radius = radii[depth] ?? 0;
      boxes.set(
        child,
        centredBox(child, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }),
      );
      place(child, depth + 1, start, start + sweep);
      start += sweep;
    }
  };
  // Start on the left, so a map with two branches puts them left and right of
  // the title rather than above and below it.
  place(root, 1, Math.PI / 2, Math.PI / 2 + Math.PI * 2);
  return boxes;
}

/**
 * Radius of every ring, indexed by depth. Each ring clears the one inside it
 * by a card's size, and is long enough to seat its cards side by side.
 */
function ringRadii(root: LayoutInput): number[] {
  const levels: LayoutInput[][] = [];
  const collect = (node: LayoutInput, depth: number): void => {
    levels[depth] ??= [];
    levels[depth]?.push(node);
    for (const child of node.children) collect(child, depth + 1);
  };
  collect(root, 0);

  const extent = (node: LayoutInput): number => Math.max(node.width, node.height);
  const radii = [0];
  for (let depth = 1; depth < levels.length; depth++) {
    const ring = levels[depth] ?? [];
    const inner = levels[depth - 1] ?? [];
    const largestInner = Math.max(...inner.map(extent));
    const largest = Math.max(...ring.map(extent));
    const clearance = (radii[depth - 1] ?? 0) + largestInner / 2 + largest / 2 + RING_GAP;
    const around = ring.reduce(
      (sum, node) => sum + (node.width + node.height) / 2 + RING_SPACING,
      0,
    );
    radii.push(Math.max(clearance, around / (Math.PI * 2)));
  }
  return radii;
}

function centredBox(node: LayoutInput, centre: Point): Box {
  return {
    left: centre.x - node.width / 2,
    top: centre.y - node.height / 2,
    width: node.width,
    height: node.height,
  };
}

/** The smallest box holding every box given. */
export function boundsOf(boxes: Iterable<Box>): Box {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    left = Math.min(left, box.left);
    top = Math.min(top, box.top);
    right = Math.max(right, box.left + box.width);
    bottom = Math.max(bottom, box.top + box.height);
  }
  if (left === Number.POSITIVE_INFINITY) return { left: 0, top: 0, width: 0, height: 0 };
  return { left, top, width: right - left, height: bottom - top };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The zoom at which `bounds` fits `viewport` with `padding` all round, never
 * above 1 — a card drawn larger than life gains nothing — and never below
 * `minZoom`.
 */
export function fitZoom(bounds: Box, viewport: Size, padding: number, minZoom: number): number {
  const across = (viewport.width - padding * 2) / Math.max(bounds.width, 1);
  const down = (viewport.height - padding * 2) / Math.max(bounds.height, 1);
  return clamp(Math.min(across, down, 1), minZoom, 1);
}

/**
 * Centre `bounds` in `viewport` at `zoom`. When it is still too large on an
 * axis, it starts at the padding instead, so the title — top left in a tree —
 * stays on screen rather than the middle of a map wider than the window.
 */
export function centreView(bounds: Box, viewport: Size, padding: number, zoom: number): View {
  const offset = (start: number, length: number, room: number): number => {
    const drawn = length * zoom;
    if (drawn > room - padding * 2) return padding - start * zoom;
    return (room - drawn) / 2 - start * zoom;
  };
  return {
    x: offset(bounds.left, bounds.width, viewport.width),
    y: offset(bounds.top, bounds.height, viewport.height),
    zoom,
  };
}

/** Zoom by `factor` about `point` (viewport coordinates), so that point stays put. */
export function zoomAround(view: View, factor: number, point: Point): View {
  const zoom = clamp(view.zoom * factor, ZOOM_LIMITS.min, ZOOM_LIMITS.max);
  const scale = zoom / view.zoom;
  return {
    x: point.x - (point.x - view.x) * scale,
    y: point.y - (point.y - view.y) * scale,
    zoom,
  };
}

/**
 * The smallest pan that brings `box` (map coordinates) inside the viewport.
 * When the box is larger than the viewport on an axis, its start wins.
 */
export function panToShow(view: View, box: Box, viewport: Size, padding: number): View {
  const shift = (start: number, length: number, room: number, current: number): number => {
    const from = start * view.zoom + current;
    const to = from + length * view.zoom;
    if (from < padding) return current + padding - from;
    if (to > room - padding) return current - Math.min(to - (room - padding), from - padding);
    return current;
  };
  return {
    x: shift(box.left, box.width, viewport.width, view.x),
    y: shift(box.top, box.height, viewport.height, view.y),
    zoom: view.zoom,
  };
}

/** Interpolate two boxes; `t` runs 0…1. */
export function mixBox(from: Box, to: Box, t: number): Box {
  return {
    left: from.left + (to.left - from.left) * t,
    top: from.top + (to.top - from.top) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

/** Interpolate two views; `t` runs 0…1. */
export function mixView(from: View, to: View, t: number): View {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}
