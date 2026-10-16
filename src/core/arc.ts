/**
 * Geometry for a walkthrough move — a gentle curve from one card to another —
 * and for the branches of a mind map.
 *
 * why a curve and not a straight line: cards sit in a wrapping grid, so a move
 * between the first and third card in a row would run straight through the
 * second. Bowing the path clears it, and bowing it to the *left of travel* means
 * a request (left to right) arcs over the row while its reply (right to left)
 * arcs under it — the two read as a pair without a single label.
 *
 * Pure numbers in, numbers out: no DOM, so it is testable in Node and identical
 * whichever theme drew the cards.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle in the stage's own coordinates. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A quadratic Bézier: leaves `start`, pulled toward `control`, lands on `end`. */
export interface Arc {
  readonly start: Point;
  readonly control: Point;
  readonly end: Point;
}

/** Fraction of the distance the curve bows out, and the most it ever bows. */
const BEND = 0.22;
const MAX_BEND = 64;
/** Gap left between a card's border and the end of the line. */
const CLEARANCE = 5;

export function centreOf(box: Box): Point {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * The curve a token follows from `from` to `to`.
 *
 * `bounds` is the stage's size: the control point is kept inside it, so a
 * curve beside the outer column bows less rather than leaving the stage.
 */
export function arcBetween(from: Box, to: Box, bounds?: { width: number; height: number }): Arc {
  const a = centreOf(from);
  const b = centreOf(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;

  // The unit normal on the left of travel: up for a rightward move, down for
  // a leftward one, right for a downward one. A quadratic curve's apex sits
  // halfway to its control point, so the control point goes twice as far.
  const bend = Math.min(length * BEND, MAX_BEND) * 2;
  const control = clampTo(
    {
      x: (a.x + b.x) / 2 + (dy / length) * bend,
      y: (a.y + b.y) / 2 - (dx / length) * bend,
    },
    bounds,
  );

  return { start: edgeToward(from, control), control, end: edgeToward(to, control) };
}

/** The point at `t` (0…1) along the curve. */
export function pointOnArc(arc: Arc, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * arc.start.x + 2 * u * t * arc.control.x + t * t * arc.end.x,
    y: u * u * arc.start.y + 2 * u * t * arc.control.y + t * t * arc.end.y,
  };
}

/** SVG path data for the curve. */
export function arcPath(arc: Arc): string {
  const { start, control, end } = arc;
  return `M${round(start.x)} ${round(start.y)}Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`;
}

/** A small filled arrowhead at the end of the curve, pointing along it. */
export function arrowheadPath(arc: Arc, size = 7): string {
  const tip = arc.end;
  const dx = tip.x - arc.control.x;
  const dy = tip.y - arc.control.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const baseX = tip.x - ux * size;
  const baseY = tip.y - uy * size;
  const half = size * 0.6;
  const left = { x: baseX - uy * half, y: baseY + ux * half };
  const right = { x: baseX + uy * half, y: baseY - ux * half };
  return `M${round(tip.x)} ${round(tip.y)}L${round(left.x)} ${round(left.y)}L${round(right.x)} ${round(right.y)}Z`;
}

/**
 * A mind-map branch in the tree layout: out of the parent's right edge, into
 * the child's left edge, as a horizontal S-curve. Both control points sit
 * halfway across, so siblings fan out from one point and arrive level.
 */
export function branchPath(from: Box, to: Box): string {
  const start = { x: from.left + from.width, y: from.top + from.height / 2 };
  const end = { x: to.left, y: to.top + to.height / 2 };
  const middle = start.x + (end.x - start.x) / 2;
  return `M${round(start.x)} ${round(start.y)}C${round(middle)} ${round(start.y)} ${round(middle)} ${round(end.y)} ${round(end.x)} ${round(end.y)}`;
}

/**
 * Where a ray from the box's centre toward `toward` leaves the box, plus a
 * little clearance — so a line starts at a card's border, not under its text.
 */
export function edgeToward(box: Box, toward: Point): Point {
  const centre = centreOf(box);
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  if (dx === 0 && dy === 0) return centre;

  const halfWidth = box.width / 2 + CLEARANCE;
  const halfHeight = box.height / 2 + CLEARANCE;
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy),
  );
  return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}

function clampTo(point: Point, bounds?: { width: number; height: number }): Point {
  if (!bounds) return point;
  return {
    x: Math.min(Math.max(point.x, 0), bounds.width),
    y: Math.min(Math.max(point.y, 0), bounds.height),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
