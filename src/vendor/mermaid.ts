/**
 * The Mermaid wrapper.
 *
 * MUST (§4.2): this is the single swappable module, so the CDN, standalone and
 * ESM builds differ by exactly one aliased import. `@mermaid-source` is rewritten
 * per build mode in `vite.config.ts`; the source tree is never forked.
 *
 * Mermaid is themed from `--doc-*` tokens so diagrams match the document
 * instead of arriving in Mermaid's own palette (§8.6).
 */

import { loadMermaidModule, MERMAID_VERSION } from '@mermaid-source';

export { MERMAID_VERSION };

/** The slice of Mermaid's API this library uses. */
interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  render(id: string, source: string): Promise<{ svg: string }>;
}

let mermaidPromise: Promise<MermaidApi> | null = null;
let diagramCounter = 0;

/**
 * Render one diagram to SVG markup.
 *
 * Rejects when Mermaid is unavailable (offline in the CDN build, or an
 * uninstalled peer dependency), which `doc-figure` renders as a visible,
 * explanatory failure rather than an empty box.
 */
export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await loadMermaid();
  diagramCounter += 1;
  const { svg } = await mermaid.render(`doc-mermaid-${diagramCounter}`, source);
  return svg;
}

/** Load Mermaid once per document and configure it from the current tokens. */
function loadMermaid(): Promise<MermaidApi> {
  if (mermaidPromise) return mermaidPromise;

  mermaidPromise = loadMermaidModule().then((module) => {
    const mermaid = module as MermaidApi;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: readFontFamily(),
      themeVariables: themeVariables(),
    });
    return mermaid;
  });

  return mermaidPromise;
}

/**
 * Map `--doc-*` tokens onto Mermaid's theme variables.
 *
 * why read from the live document rather than hardcode: the accent preset and
 * the light/dark scheme are both resolved at runtime, so a diagram in an
 * `accent="plum"` document in dark mode has to pick up both.
 *
 * ── Why this map is long ────────────────────────────────────────────────────
 *
 * Mermaid's `base` theme fills every variable it was not given, and it does so
 * on light-mode assumptions. Some of those defaults are *derivations* — a
 * secondary text colour is `invert(secondaryColor)`, an arrowhead is
 * `invert(background)` — and inverting a dark surface produces a light one, so
 * they land roughly right by accident. The dangerous ones are the defaults that
 * are simply **constants**: `noteBkgColor: "#fff5ad"`, `gridColor:
 * "lightgrey"`, `altSectionBkgColor: "white"`, `doneTaskBkgColor: "lightgrey"`,
 * `pieStrokeColor: "black"`, `critBkgColor: "red"`. Those never change, so a
 * dark document got a fluorescent sticky note and a white gantt band, and a
 * light one got Mermaid's palette instead of the document's.
 *
 * So every variable set below is one Mermaid would otherwise decide for itself
 * and get wrong in at least one scheme. Grouped by the diagram family that
 * reads it, because that is how they are verified.
 */
export function themeVariables(): Record<string, string> {
  const probe = new TokenProbe();
  const INK = documentInk();

  try {
    const surface1 = probe.color('--doc-surface-1', INK.surface);
    const surface2 = probe.color('--doc-surface-2', INK.surface);
    const surface3 = probe.color('--doc-surface-3', INK.surface);
    const text1 = probe.color('--doc-text-1', INK.text);
    const text2 = probe.color('--doc-text-2', INK.text);
    const text3 = probe.color('--doc-text-3', INK.text);
    const border1 = probe.color('--doc-border-1', INK.text);
    const border2 = probe.color('--doc-border-2', INK.text);
    const tint = probe.color('--doc-accent-tint', INK.surface);
    const accentLine = probe.color('--doc-accent-line', INK.text);
    const accentSolid = probe.color('--doc-accent-solid', INK.text);
    const onAccent = probe.color('--doc-accent-on-solid', INK.surface);
    const series = seriesPalette(probe, INK);
    // Series 5 is the danger ramp: gantt's critical bars and today line.
    const critical = probe.color('--doc-series-5', INK.text);
    const criticalTint = probe.color('--doc-danger-tint', INK.surface);

    return {
      /* ── Core: flowchart, and the base every other family derives from ──
         `lineColor` is the one that was visibly wrong in *both* schemes.
         `--doc-border-2` is a table-rule colour — 1.7:1 against the figure in
         either scheme — and every edge, arrowhead and connector inherits it,
         so a flowchart's arrows were nearly invisible on a white page too, not
         only on a dark one. Edges carry meaning; they get a text-grade token. */
      background: surface1,
      primaryColor: tint,
      primaryTextColor: text1,
      primaryBorderColor: accentLine,
      secondaryColor: surface2,
      secondaryTextColor: text1,
      secondaryBorderColor: border2,
      tertiaryColor: surface3,
      tertiaryTextColor: text1,
      tertiaryBorderColor: border2,
      textColor: text1,
      lineColor: text3,
      arrowheadColor: text3,
      defaultLinkColor: text3,
      border1,
      border2,
      mainBkg: tint,
      nodeBkg: tint,
      nodeBorder: accentLine,
      nodeTextColor: text1,
      titleColor: text1,
      labelColor: text1,
      // Edge labels sit on top of the edge, so they need the figure's own
      // surface behind them rather than Mermaid's darkened secondary.
      edgeLabelBackground: surface1,
      clusterBkg: surface2,
      clusterBorder: border2,
      errorBkgColor: critical,
      errorTextColor: onAccent,

      /* ── Sequence ──
         The note is the sticky-note yellow Mermaid hardcodes in the
         constructor, where the `||` fallbacks can never reach it. The document
         already has a highlight pair for exactly this look, in both schemes. */
      actorBkg: tint,
      actorBorder: accentLine,
      actorTextColor: text1,
      // The lifeline and the loop box are structure, not decoration: same
      // reasoning as `lineColor` above.
      actorLineColor: text3,
      signalColor: text2,
      signalTextColor: text1,
      labelBoxBkgColor: surface2,
      labelBoxBorderColor: text3,
      labelTextColor: text1,
      loopTextColor: text1,
      noteBkgColor: probe.color('--doc-code-highlight-row', INK.surface),
      noteTextColor: probe.color('--doc-highlight-text', INK.text),
      noteBorderColor: probe.color('--doc-warn-tint', INK.text),
      activationBkgColor: surface3,
      activationBorderColor: border2,
      // Drawn inside a disc filled with `lineColor`, so it must contrast with
      // the line, not with the page.
      sequenceNumberColor: surface1,

      /* ── State ── */
      transitionColor: text3,
      transitionLabelColor: text1,
      stateBkg: tint,
      stateLabelColor: text1,
      labelBackgroundColor: surface1,
      compositeBackground: surface2,
      compositeTitleBackground: surface3,
      compositeBorder: border2,
      altBackground: surface3,

      /* ── Class and ER ──
         `rowOdd`/`rowEven` are lightened off `mainBkg` by 75, which turns the
         dark tint into a near-white attribute table. */
      classText: text1,
      rowOdd: surface1,
      rowEven: surface2,
      attributeBackgroundColorOdd: surface1,
      attributeBackgroundColorEven: surface2,

      /* ── Gantt ──
         Six of these are hardcoded English colour names in Mermaid's base
         theme: `white`, `lightgrey` twice, `grey`, `red` twice, `navy`. */
      sectionBkgColor: surface2,
      sectionBkgColor2: surface3,
      altSectionBkgColor: surface1,
      excludeBkgColor: surface3,
      taskBkgColor: tint,
      taskBorderColor: accentLine,
      taskTextColor: text1,
      taskTextDarkColor: text1,
      taskTextLightColor: text1,
      taskTextOutsideColor: text1,
      taskTextClickableColor: accentLine,
      activeTaskBkgColor: accentSolid,
      activeTaskBorderColor: accentLine,
      doneTaskBkgColor: surface3,
      doneTaskBorderColor: border2,
      // A critical bar is a tint plus a line, not a solid, for the same reason
      // `doc-note[kind="danger"]` is: the bar carries a label in `taskTextColor`,
      // and no single ink reads on a saturated fill in both schemes.
      critBkgColor: criticalTint,
      critBorderColor: critical,
      todayLineColor: critical,
      vertLineColor: border2,
      gridColor: border1,

      /* ── Pie, class fill types and the journey/timeline scale ── */
      ...indexed('pie', 1, series),
      pieTitleTextColor: text1,
      pieSectionTextColor: onAccent,
      pieLegendTextColor: text1,
      pieStrokeColor: surface1,
      pieOuterStrokeColor: border2,
      // Mermaid composites slices at 0.7 alpha, which washes every token colour
      // toward whichever surface is behind it — the palette has to survive.
      pieOpacity: '1',
      ...indexed('fillType', 0, series),
      // why the scale is read pre-lightened: Mermaid darkens every `cScale*` by
      // a fixed 25 *after* the theme is applied, so handing it the token value
      // directly would render every journey section a step darker than the
      // palette the rest of the document uses. `hsl(from …)` does the
      // compensation in the engine — see `TokenProbe.lightened`.
      ...indexed('cScale', 0, seriesPalette(probe, INK, 25)),
      ...indexed(
        'cScaleLabel',
        0,
        series.map(() => onAccent),
      ),
      scaleLabelColor: onAccent,

      fontSize: probe.length('--doc-text-sm', '14px'),
    };
  } finally {
    probe.dispose();
  }
}

/** How many `--doc-series-*` tokens the token layer defines. */
const SERIES_COUNT = 8;

/** The `--doc-series-*` tokens, optionally lightened, cycled to twelve. */
function seriesPalette(probe: TokenProbe, ink: Ink, lighten = 0): string[] {
  const base = Array.from({ length: SERIES_COUNT }, (_, index) =>
    probe.color(`--doc-series-${index + 1}`, ink.text, lighten),
  );
  // Mermaid's scales run to twelve; the palette holds eight distinguishable
  // hues, so the last four repeat rather than inventing muddy ones.
  return Array.from({ length: 12 }, (_, index) => base[index % SERIES_COUNT] as string);
}

/** `{ pie1: …, pie2: … }` — Mermaid's one-per-index theme variables. */
function indexed(prefix: string, from: number, values: string[]): Record<string, string> {
  return Object.fromEntries(values.map((value, index) => [`${prefix}${from + index}`, value]));
}

/** The document's own resolved ink, used when a token does not resolve at all. */
interface Ink {
  text: string;
  surface: string;
}

/**
 * The last resort behind every token read below.
 *
 * why not a pair of hex literals: this module must not know what any theme
 * looks like. A hardcoded `#ffffff` is a light-mode constant, and a light-mode
 * constant leaking into a dark document is precisely the failure documented on
 * `toParseableColor` — it would come straight back the moment a new palette
 * landed. The page's own computed text and background colours are whatever the
 * *current* theme resolved them to, so they move with it and stay legible
 * against each other by construction. A token failing to resolve means the
 * stylesheet is absent, not that a theme is unusual.
 */
function documentInk(): Ink {
  const host = document.querySelector('doc-page') ?? document.body;
  const computed = getComputedStyle(host);
  return {
    text: toParseableColor(computed.color.trim()) ?? 'rgb(0, 0, 0)',
    surface: toParseableColor(computed.backgroundColor.trim()) ?? 'rgb(255, 255, 255)',
  };
}

/** Font family is read on its own, before the probe is disposed. */
function readFontFamily(): string {
  const probe = new TokenProbe();
  try {
    return probe.read('font-family', '--doc-font-sans', 'system-ui, sans-serif');
  } finally {
    probe.dispose();
  }
}

/**
 * Resolves a `--doc-*` token to a concrete value.
 *
 * why a probe element rather than `getComputedStyle(docPage).getPropertyValue()`
 * — this was a real bug, and a subtle one: an unregistered custom property
 * computes to its *token stream*, so reading `--doc-accent-tint` in dark mode
 * hands back the literal string `color-mix(in oklab, #073d36 42%, #101214)`.
 * Mermaid's colour parser rejects that outright ("Unsupported color format"),
 * so every diagram in every dark-mode document rendered an error box instead.
 *
 * Feeding the token through a real property makes the browser resolve
 * `color-mix()`, `light-dark()` and `calc()` down to something Mermaid can
 * parse. The probe is created and removed within a single task, so nothing can
 * observe it — and it is chrome, never author content (§2.2).
 */
class TokenProbe {
  readonly #element = document.createElement('span');

  constructor() {
    this.#element.style.display = 'none';
    const host = document.querySelector('doc-page') ?? document.body;
    host.append(this.#element);
  }

  read(property: string, token: string, fallback: string): string {
    this.#element.style.removeProperty(property);
    this.#element.style.setProperty(property, `var(${token})`);
    const value = getComputedStyle(this.#element).getPropertyValue(property).trim();
    return value || fallback;
  }

  /**
   * A token as an sRGB `rgb()` string.
   *
   * why the relative-colour syntax rather than plain `var()`: the accent tints
   * are built with `color-mix(in oklab, …)`, and the browser resolves those to
   * an `oklab()` value. Mermaid's colour parser handles hex, `rgb()` and `hsl()`
   * and nothing else, so an oklab value fails exactly as the raw `color-mix()`
   * string did. `rgb(from … r g b)` forces the conversion in the engine, which
   * is the only place that can do it correctly.
   */
  /**
   * @param lighten HSL lightness points to add, for the one caller that has to
   *   pre-compensate for Mermaid darkening the value again. Doing the maths in
   *   `hsl(from …)` keeps every colour conversion in the engine, which is the
   *   only place that gets `color-mix(in oklab, …)` right.
   */
  color(token: string, fallback: string, lighten = 0): string {
    const expression = lighten
      ? `hsl(from var(${token}) h s calc(l + ${lighten}))`
      : `rgb(from var(${token}) r g b)`;

    this.#element.style.removeProperty('color');
    this.#element.style.setProperty('color', expression);

    const converted = toParseableColor(getComputedStyle(this.#element).color.trim());
    if (converted) return converted;

    // No relative-colour support: take the token as-is and hope it is simple.
    const raw = toParseableColor(this.read('color', token, fallback));
    return raw ?? fallback;
  }

  length(token: string, fallback: string): string {
    return this.read('font-size', token, fallback);
  }

  dispose(): void {
    this.#element.remove();
  }
}

/**
 * Coerce a computed colour into something Mermaid's parser accepts, or `null`.
 *
 * why this is not a plain format test — and this was the second half of the
 * dark-mode bug: `rgb(from … r g b)` does force sRGB, but the *serialisation*
 * is up to the engine. Chrome hands back `color(srgb 0.067 0.138 0.132)`
 * whenever the origin colour was not already sRGB, which is exactly the case
 * for every `color-mix(in oklab, …)` token — i.e. the dark accent tint.
 *
 * Mermaid parses hex, `rgb()` and `hsl()` and nothing else, so `color(srgb …)`
 * was rejected and each affected variable fell through to its hardcoded
 * *light-mode* fallback. Dark documents therefore drew light mint node fills
 * under light body text: legible in neither scheme's palette, unreadable in
 * dark. Converting the channels here is the whole fix — the values are already
 * sRGB, only the spelling is wrong.
 */
function toParseableColor(value: string): string | null {
  if (/^(#|rgba?\(|hsla?\()/i.test(value)) return value;

  const srgb = /^color\(\s*srgb\s+([^)]+)\)$/i.exec(value);
  if (!srgb) return null;

  const [red, green, blue, alpha] = (srgb[1] ?? '').replace('/', ' ').trim().split(/\s+/);
  const channel = (part: string | undefined): number =>
    Math.round(Math.min(1, Math.max(0, Number(part) || 0)) * 255);

  const rgb = [channel(red), channel(green), channel(blue)];
  if (rgb.some(Number.isNaN)) return null;

  const opacity = alpha === undefined ? 1 : Math.min(1, Math.max(0, Number(alpha) || 0));
  return opacity === 1 ? `rgb(${rgb.join(', ')})` : `rgba(${rgb.join(', ')}, ${opacity})`;
}
