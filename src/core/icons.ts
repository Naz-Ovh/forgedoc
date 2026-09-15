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
  return icon('chevron', 'M9 5l7 7-7 7');
}

/** The table-of-contents toggle. */
export function menuIcon(): SVGSVGElement {
  return icon('menu-icon', 'M4 7h16M4 12h16M4 17h16');
}

/** Dismiss, for the endpoint drawer. */
export function closeIcon(): SVGSVGElement {
  return icon('close-icon', 'M6 6l12 12M18 6L6 18');
}

/** Forward: flow edges, the endpoint trigger, the carousel's next control. */
export function arrowRightIcon(part = 'arrow-icon'): SVGSVGElement {
  return icon(part, 'M4 12h15m-6-7l7 7-7 7');
}

/** Back, for the carousel's previous control. */
export function arrowLeftIcon(part = 'arrow-icon'): SVGSVGElement {
  return icon(part, 'M20 12H5m6-7l-7 7 7 7');
}

/** A button whose whole content is one icon, with an accessible name. */
export function iconButton(part: string, label: string, glyph: SVGSVGElement): HTMLButtonElement {
  const button = createPart(part, 'button') as HTMLButtonElement;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(glyph);
  return button;
}
