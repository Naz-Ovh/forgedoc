/**
 * The runtime's icons, as inline SVG.
 *
 * why not a glyph (`▸`, `☰`, `×`): a text character is drawn by whatever font
 * the reader happens to have, and the geometric shapes have the worst coverage
 * of any block in Unicode. `▸` renders as a hairline sliver in Plus Jakarta, as
 * a filled wedge in the fallback, as a tofu box where neither is installed, and
 * it sits on the text baseline rather than centred on the row it belongs to.
 * None of that is tunable from CSS.
 *
 * why not an icon font or a sprite: §2.3 — a document has to work from
 * `file://` with no network, and every byte of it is inlined into one file.
 *
 * So: inline SVG, drawn on a 24-unit grid, stroked in `currentColor` at a width
 * that holds up at 14px. `width`/`height` are `1em`, so an icon is sized by the
 * `font-size` of the chrome that holds it and needs no rule of its own.
 */

import { createPart } from './parts.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The geometry, separated from the DOM call that draws it.
 *
 * why exported: the bucket and the question drawer are Svelte, and a Svelte
 * template writes its own `<svg>` markup rather than calling into here. Sharing
 * the path data is what keeps the two from drifting into two slightly different
 * chevrons.
 */
export const ICON_PATHS = {
  chevron: 'M9 5l7 7-7 7',
  menu: 'M4 7h16M4 12h16M4 17h16',
  comment: 'M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z',
  questions: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  close: 'M6 6l12 12M18 6L6 18',
  arrowRight: 'M4 12h15m-6-7l7 7-7 7',
  arrowLeft: 'M20 12H5m6-7l-7 7 7 7',
} as const;

/** One `<svg>` carrying a part name, sized in `em` and painted in `currentColor`. */
function icon(part: string, pathData: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.dataset.part = part;
  svg.dataset.docChrome = '';
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '1em');
  svg.setAttribute('height', '1em');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.25');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // MUST (§7.3): decorative, and the control around it already has a name.
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.append(path);

  return svg;
}

/**
 * The disclosure chevron: points at the row when closed, down when open.
 *
 * The rotation is CSS (`:state(open)`), so this is only ever the closed shape.
 */
export function chevronIcon(): SVGSVGElement {
  return icon('chevron', ICON_PATHS.chevron);
}

/** The table-of-contents toggle. */
export function menuIcon(): SVGSVGElement {
  return icon('menu-icon', ICON_PATHS.menu);
}

/**
 * Comment, for the block-level feedback button.
 *
 * A speech bubble rather than a pencil or a plus: the button opens a composer
 * for something the reader wants to *say* about the block, and a pencil reads
 * as "edit this document", which is the one thing a reader cannot do.
 */
export function commentIcon(part = 'comment-icon'): SVGSVGElement {
  return icon(part, ICON_PATHS.comment);
}

/** A question mark in a circle: the contents panel's question-list trigger. */
export function questionIcon(part = 'questions-icon'): SVGSVGElement {
  return icon(part, ICON_PATHS.questions);
}

/** Dismiss, for the endpoint drawer. */
export function closeIcon(): SVGSVGElement {
  return icon('close-icon', ICON_PATHS.close);
}

/** Forward: flow edges, the endpoint trigger, the carousel's next control. */
export function arrowRightIcon(part = 'arrow-icon'): SVGSVGElement {
  return icon(part, ICON_PATHS.arrowRight);
}

/** Back, for the carousel's previous control. */
export function arrowLeftIcon(part = 'arrow-icon'): SVGSVGElement {
  return icon(part, ICON_PATHS.arrowLeft);
}

/** A button whose whole content is one icon, with an accessible name. */
export function iconButton(part: string, label: string, glyph: SVGSVGElement): HTMLButtonElement {
  const button = createPart(part, 'button') as HTMLButtonElement;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(glyph);
  return button;
}
