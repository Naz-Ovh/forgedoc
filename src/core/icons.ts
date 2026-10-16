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

import type { NODE_ICONS } from './contract.js';
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
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M8.5 5v14M15.5 5v14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  app: 'M3.5 5h17v14h-17zM3.5 9h17M6.5 7h.01',
  service: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  table: 'M3.5 5h17v14h-17zM3.5 10h17M3.5 14.5h17M9.5 5v14',
  store:
    'M4.5 6.5c0-1.7 3.4-3 7.5-3s7.5 1.3 7.5 3-3.4 3-7.5 3-7.5-1.3-7.5-3zM4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3',
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

/** Play and pause, for the walkthrough's transport control. */
export function playIcon(playing: boolean): SVGSVGElement {
  return icon('play-icon', playing ? ICON_PATHS.pause : ICON_PATHS.play);
}

/** Accept and reject marks, for a walkthrough move's outcome. */
export function resultIcon(result: 'accept' | 'reject'): SVGSVGElement {
  return icon('result-icon', result === 'accept' ? ICON_PATHS.check : ICON_PATHS.close);
}

/** The actor kinds a walkthrough card can carry an icon for. */
export type ActorKind = 'person' | 'app' | 'service' | 'table' | 'store';

/** The glyph on a walkthrough actor's card. */
export function actorIcon(kind: ActorKind): SVGSVGElement {
  return icon('card-icon', ICON_PATHS[kind]);
}

/** An icon name a mind-map card accepts (`doc-node icon="…"`). */
export type NodeIcon = (typeof NODE_ICONS)[number];

/** Which drawing each mind-map icon name uses: two are everyday aliases. */
const NODE_ICON_PATHS: Readonly<Record<NodeIcon, string>> = {
  person: ICON_PATHS.person,
  app: ICON_PATHS.app,
  service: ICON_PATHS.service,
  server: ICON_PATHS.service,
  table: ICON_PATHS.table,
  store: ICON_PATHS.store,
  database: ICON_PATHS.store,
  check: ICON_PATHS.check,
  comment: ICON_PATHS.comment,
  question: ICON_PATHS.questions,
};

/** The glyph before a mind-map card's title, or null for a name it does not know. */
export function nodeIcon(name: string): SVGSVGElement | null {
  const path = (NODE_ICON_PATHS as Readonly<Record<string, string>>)[name];
  return path ? icon('icon', path) : null;
}

/** A button whose whole content is one icon, with an accessible name. */
export function iconButton(part: string, label: string, glyph: SVGSVGElement): HTMLButtonElement {
  const button = createPart(part, 'button') as HTMLButtonElement;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(glyph);
  return button;
}
