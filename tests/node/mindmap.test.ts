/**
 * `core/mindmap.ts` — the mind map's geometry, which has no DOM and so is
 * tested here, in Node: the `expand` grammar, the two layouts, and the view
 * maths behind Fit, zoom and keeping a card on screen.
 */

import { describe, expect, it } from 'vitest';

import type { Box } from '../../src/core/arc.js';
import { branchPath } from '../../src/core/arc.js';
import {
  boundsOf,
  centreView,
  fitZoom,
  isValidExpand,
  type LayoutInput,
  layoutRadial,
  layoutTree,
  panToShow,
  parseExpand,
  startsOpen,
  ZOOM_LIMITS,
  zoomAround,
} from '../../src/core/mindmap.js';

const card = (children: LayoutInput[] = [], width = 100, height = 40): LayoutInput => ({
  width,
  height,
  children,
});

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

function assertNoOverlap(boxes: Map<LayoutInput, Box>): void {
  const all = [...boxes.values()];
  for (const [index, box] of all.entries()) {
    for (const other of all.slice(index + 1)) expect(overlaps(box, other)).toBe(false);
  }
}

describe('expand', () => {
  it('reads none, all and a number of levels, defaulting to one level', () => {
    expect(parseExpand('none')).toBe(0);
    expect(parseExpand('all')).toBe(Number.POSITIVE_INFINITY);
    expect(parseExpand('2')).toBe(2);
    expect(parseExpand(null)).toBe(1);
    expect(parseExpand('lots')).toBe(1);
  });

  it('accepts only what parseExpand understands', () => {
    expect(['none', 'all', '0', '3'].every(isValidExpand)).toBe(true);
    expect(['', 'lots', '-1', '1.5', 'ALL levels'].some(isValidExpand)).toBe(false);
  });

  it("lets a card's own open or closed beat the map's depth", () => {
    expect(startsOpen(1, 1, { open: false, closed: false })).toBe(false);
    expect(startsOpen(0, 1, { open: false, closed: false })).toBe(true);
    expect(startsOpen(3, 1, { open: true, closed: false })).toBe(true);
    expect(startsOpen(0, 9, { open: false, closed: true })).toBe(false);
  });
});

describe('tree layout', () => {
  it('puts children in a column to the right of their parent, centred on it', () => {
    const a = card();
    const b = card();
    const root = card([a, b]);
    const boxes = layoutTree(root);
    const rootBox = boxes.get(root) as Box;
    const aBox = boxes.get(a) as Box;
    const bBox = boxes.get(b) as Box;

    expect(aBox.left).toBeGreaterThan(rootBox.left + rootBox.width);
    expect(aBox.left).toBe(bBox.left);
    expect(bBox.top).toBeGreaterThan(aBox.top + aBox.height);
    const middle = (box: Box): number => box.top + box.height / 2;
    expect(middle(rootBox)).toBeCloseTo((middle(aBox) + middle(bBox)) / 2);
  });

  it('never overlaps two cards, however uneven the branches', () => {
    const deep = card([card([card(), card(), card()], 160, 120), card()]);
    const root = card([deep, card([], 220, 200), card([card(), card()])]);
    assertNoOverlap(layoutTree(root));
  });
});

describe('radial layout', () => {
  it('centres the title and rings its branches around it without overlap', () => {
    const root = card([card([card(), card()]), card(), card(), card([card()])], 140, 50);
    const boxes = layoutRadial(root);
    const rootBox = boxes.get(root) as Box;
    expect(rootBox.left + rootBox.width / 2).toBeCloseTo(0);
    expect(rootBox.top + rootBox.height / 2).toBeCloseTo(0);
    assertNoOverlap(boxes);
  });

  it('puts the first of two branches on the left and the second on the right', () => {
    const left = card();
    const right = card();
    const boxes = layoutRadial(card([left, right]));
    expect((boxes.get(left) as Box).left).toBeLessThan(0);
    expect((boxes.get(right) as Box).left).toBeGreaterThan(0);
  });
});

describe('view', () => {
  const viewport = { width: 800, height: 400 };

  it('fits a large map by zooming out, and never zooms a small one past 1', () => {
    const large = { left: 0, top: 0, width: 1600, height: 400 };
    expect(fitZoom(large, viewport, 20, ZOOM_LIMITS.min)).toBeCloseTo(760 / 1600);
    expect(fitZoom({ left: 0, top: 0, width: 100, height: 50 }, viewport, 20, 0.3)).toBe(1);
  });

  it('centres what fits, and starts what does not at the padding', () => {
    const small = centreView({ left: 0, top: 0, width: 200, height: 100 }, viewport, 20, 1);
    expect(small.x).toBe(300);
    expect(small.y).toBe(150);
    const wide = centreView({ left: -50, top: 0, width: 2000, height: 100 }, viewport, 20, 1);
    expect(wide.x).toBe(70);
  });

  it('zooms about the pointer, so the point under it stays put', () => {
    const view = { x: 10, y: 20, zoom: 1 };
    const point = { x: 300, y: 200 };
    const zoomed = zoomAround(view, 1.5, point);
    const before = { x: (point.x - view.x) / view.zoom, y: (point.y - view.y) / view.zoom };
    expect(before.x * zoomed.zoom + zoomed.x).toBeCloseTo(point.x);
    expect(before.y * zoomed.zoom + zoomed.y).toBeCloseTo(point.y);
    expect(zoomAround(view, 100, point).zoom).toBe(ZOOM_LIMITS.max);
  });

  it('pans only as far as it takes to show a card', () => {
    const view = { x: 0, y: 0, zoom: 1 };
    const inside = { left: 100, top: 100, width: 50, height: 50 };
    expect(panToShow(view, inside, viewport, 20)).toEqual(view);
    const right = panToShow(view, { left: 900, top: 100, width: 100, height: 50 }, viewport, 20);
    expect(900 + 100 + right.x).toBe(780);
  });

  it('bounds every box given', () => {
    expect(
      boundsOf([
        { left: -10, top: 5, width: 20, height: 10 },
        { left: 40, top: -5, width: 10, height: 10 },
      ]),
    ).toEqual({ left: -10, top: -5, width: 60, height: 20 });
  });
});

describe('branch lines', () => {
  it('leave the right edge of the parent and land on the left edge of the child', () => {
    const path = branchPath(
      { left: 0, top: 0, width: 100, height: 40 },
      { left: 160, top: 100, width: 80, height: 20 },
    );
    expect(path.startsWith('M100 20C')).toBe(true);
    expect(path.endsWith('160 110')).toBe(true);
  });
});
