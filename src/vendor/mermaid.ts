/**
 * The Mermaid wrapper.
 *
 * MUST (§4.2): this is the single swappable module, so the CDN, standalone and
 * ESM builds differ by exactly one aliased import. `@mermaid-source` is rewritten
 * per build mode in `vite.config.ts`; the source tree is never forked.
 *
 * Mermaid is themed from `--plan-*` tokens so diagrams match the document
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
 * uninstalled peer dependency), which `plan-figure` renders as a visible,
 * explanatory failure rather than an empty box.
 */
export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await loadMermaid();
  diagramCounter += 1;
  const { svg } = await mermaid.render(`plan-mermaid-${diagramCounter}`, source);
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
 * Map `--plan-*` tokens onto Mermaid's theme variables.
 *
 * why read from the live document rather than hardcode: the accent preset and
 * the light/dark scheme are both resolved at runtime, so a diagram in an
 * `accent="plum"` document in dark mode has to pick up both.
 */
export function themeVariables(): Record<string, string> {
  const probe = new TokenProbe();

  try {
    return {
      background: probe.color('--plan-surface-1', '#ffffff'),
      primaryColor: probe.color('--plan-accent-tint', '#edfaf6'),
      primaryTextColor: probe.color('--plan-text-1', '#1b1d1f'),
      primaryBorderColor: probe.color('--plan-accent-line', '#12907a'),
      lineColor: probe.color('--plan-border-2', '#ccc9c0'),
      secondaryColor: probe.color('--plan-surface-2', '#f5f4f0'),
      tertiaryColor: probe.color('--plan-surface-3', '#eceae4'),
      textColor: probe.color('--plan-text-1', '#1b1d1f'),
      mainBkg: probe.color('--plan-accent-tint', '#edfaf6'),
      nodeBorder: probe.color('--plan-accent-line', '#12907a'),
      clusterBkg: probe.color('--plan-surface-2', '#f5f4f0'),
      fontSize: probe.length('--plan-text-sm', '14px'),
    };
  } finally {
    probe.dispose();
  }
}

/** Font family is read on its own, before the probe is disposed. */
function readFontFamily(): string {
  const probe = new TokenProbe();
  try {
    return probe.read('font-family', '--plan-font-sans', 'system-ui, sans-serif');
  } finally {
    probe.dispose();
  }
}

/**
 * Resolves a `--plan-*` token to a concrete value.
 *
 * why a probe element rather than `getComputedStyle(planDoc).getPropertyValue()`
 * — this was a real bug, and a subtle one: an unregistered custom property
 * computes to its *token stream*, so reading `--plan-accent-tint` in dark mode
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
    const host = document.querySelector('plan-doc') ?? document.body;
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
  color(token: string, fallback: string): string {
    this.#element.style.removeProperty('color');
    this.#element.style.setProperty('color', `rgb(from var(${token}) r g b)`);

    const converted = getComputedStyle(this.#element).color.trim();
    if (isParseableColor(converted)) return converted;

    // No relative-colour support: take the token as-is and hope it is simple.
    const raw = this.read('color', token, fallback);
    return isParseableColor(raw) ? raw : fallback;
  }

  length(token: string, fallback: string): string {
    return this.read('font-size', token, fallback);
  }

  dispose(): void {
    this.#element.remove();
  }
}

/** The colour formats Mermaid's parser accepts. */
function isParseableColor(value: string): boolean {
  return /^(#|rgba?\(|hsla?\()/i.test(value);
}
