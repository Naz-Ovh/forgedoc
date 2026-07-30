/**
 * Acceptance 8: every preset value on every axis renders, in light and dark.
 * Acceptance 9: one line of unlayered author CSS beats every shipped rule.
 *
 * why the axes are swapped at runtime rather than fixtured: a document has
 * exactly one `doc-page`, so it can carry exactly one value per axis. Setting
 * the attribute is also the documented way to change a preset (§6.3), so this
 * exercises the real mechanism.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PRESET_AXES } from '../../src/core/contract.js';
import { mountPlan } from '../helpers.js';

/** The library's own stylesheet, loaded once for the whole file. */
let stylesheet: HTMLLinkElement | HTMLStyleElement | null = null;

beforeEach(async () => {
  if (stylesheet) return;
  // Vite serves the source stylesheet through the module graph in dev/test.
  await import('../../src/styles/index.css');
  stylesheet = document.querySelector('style[data-vite-dev-id*="index.css"]');
});

/** The raw token stream, e.g. `calc(var(--doc-space-unit) * 4)`. */
const read = (element: Element, token: string): string =>
  getComputedStyle(element).getPropertyValue(token).trim();

/**
 * The *resolved* value of a token.
 *
 * why a probe element: an unregistered custom property computes to its token
 * stream, not to a value — `getPropertyValue('--doc-space-4')` returns
 * `calc(4px * 4)`, not `16px`, and `light-dark()` stays literal until something
 * consumes it. Feeding the token into a real property is the only way to see
 * what the reader actually gets.
 */
function resolve(host: Element, token: string, property: 'padding-top' | 'color'): string {
  const probe = document.createElement('div');
  probe.style.setProperty(property, `var(${token})`);
  host.append(probe);

  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

const resolveLength = (host: Element, token: string): string => resolve(host, token, 'padding-top');
const resolveColor = (host: Element, token: string): string => resolve(host, token, 'color');
const pixels = (host: Element, token: string): number =>
  Number.parseFloat(resolveLength(host, token));

describe('preset axes', () => {
  for (const [axis, values] of Object.entries(PRESET_AXES)) {
    describe(axis, () => {
      for (const value of values) {
        it(`renders ${axis}="${value}"`, () => {
          const docPage = mountPlan(
            `<doc-section title="Preset check"><p>Body text.</p>
             <doc-note kind="info"><p>A callout.</p></doc-note>
             <doc-code lang="ts">const x = 1;</doc-code></doc-section>`,
            `doc-id="preset-${axis}-${value}" ${axis}="${value}"`,
          );

          expect(docPage.getAttribute(axis)).toBe(value);
          // Every axis must leave the derived scales *resolvable*. A preset that
          // set a token to something invalid would surface here as NaN or as an
          // empty colour, not as a plausible-looking token stream.
          expect(pixels(docPage, '--doc-space-4')).toBeGreaterThan(0);
          expect(pixels(docPage, '--doc-text-lg')).toBeGreaterThan(0);
          expect(pixels(docPage, '--doc-measure')).toBeGreaterThan(0);
          expect(resolveColor(docPage, '--doc-accent-600')).toMatch(/^(rgb|oklab|color)/);
          expect(resolveColor(docPage, '--doc-code-surface')).toMatch(/^(rgb|oklab|color)/);
        });
      }
    });
  }

  it('derives the spacing scale from one unit', () => {
    const compact = mountPlan('<p>x</p>', 'doc-id="d-compact" density="compact"');
    const spacious = mountPlan('<p>x</p>', 'doc-id="d-spacious" density="spacious"');

    expect(read(compact, '--doc-space-unit')).toBe('3px');
    expect(resolveLength(compact, '--doc-space-4')).toBe('12px');
    expect(read(spacious, '--doc-space-unit')).toBe('5px');
    expect(resolveLength(spacious, '--doc-space-4')).toBe('20px');
  });

  it('derives the type scale from one base and one ratio', () => {
    const small = mountPlan('<p>x</p>', 'doc-id="s-sm" scale="sm"');
    const large = mountPlan('<p>x</p>', 'doc-id="s-lg" scale="lg"');

    expect(read(small, '--doc-text-base')).toBe('15px');
    expect(read(large, '--doc-text-base')).toBe('18px');
    expect(pixels(large, '--doc-text-lg')).toBeGreaterThan(pixels(small, '--doc-text-lg'));
    // The ratio, not a hand-written list: lg is base × ratio.
    expect(pixels(large, '--doc-text-lg')).toBeCloseTo(18 * 1.22, 1);
    expect(pixels(small, '--doc-text-lg')).toBeCloseTo(15 * 1.18, 1);
  });

  it('moves the measure to the documented widths', () => {
    expect(read(mountPlan('<p>x</p>', 'doc-id="m1" measure="narrow"'), '--doc-measure')).toBe(
      '720px',
    );
    expect(read(mountPlan('<p>x</p>', 'doc-id="m2"'), '--doc-measure')).toBe('1200px');
    expect(read(mountPlan('<p>x</p>', 'doc-id="m3" measure="wide"'), '--doc-measure')).toBe(
      '1600px',
    );
  });

  it('changes the accent ramp without touching the semantic ramps', () => {
    const teal = mountPlan('<p>x</p>', 'doc-id="a1" accent="teal"');
    const plum = mountPlan('<p>x</p>', 'doc-id="a2" accent="plum"');

    expect(resolveColor(teal, '--doc-accent-600')).not.toBe(resolveColor(plum, '--doc-accent-600'));
    // MUST (§6.4): info/success/warning/danger do not move with `accent`.
    for (const semantic of [
      '--doc-info-600',
      '--doc-success-600',
      '--doc-warn-600',
      '--doc-danger-600',
    ]) {
      expect(resolveColor(teal, semantic)).toBe(resolveColor(plum, semantic));
    }
  });

  it('lets every axis vary independently', () => {
    const mixed = mountPlan(
      '<p>x</p>',
      'doc-id="mixed" density="compact" scale="lg" accent="plum" measure="wide" code="light"',
    );

    expect(read(mixed, '--doc-space-unit')).toBe('3px');
    expect(read(mixed, '--doc-text-base')).toBe('18px');
    expect(read(mixed, '--doc-measure')).toBe('1600px');
    expect(resolveColor(mixed, '--doc-code-surface')).toBe('rgb(247, 246, 242)');
  });
});

describe('colour scheme', () => {
  /* MUST (§6.4): `light-dark()` on one token set, with `color-scheme` on the root. */
  it('resolves the same token differently per scheme, from one declaration', () => {
    const docPage = mountPlan('<p>x</p>', 'doc-id="scheme"');

    docPage.style.colorScheme = 'light';
    const light = resolveColor(docPage, '--doc-surface-1');
    const lightText = getComputedStyle(docPage).color;

    docPage.style.colorScheme = 'dark';
    const dark = resolveColor(docPage, '--doc-surface-1');
    const darkText = getComputedStyle(docPage).color;

    // One declaration, two results — no @media duplication, no theme toggle.
    expect(read(docPage, '--doc-surface-1')).toContain('light-dark(');
    expect(light).not.toBe(dark);
    expect(lightText).not.toBe(darkText);
  });
});

describe('the override escape hatch', () => {
  let authorStyle: HTMLStyleElement;

  afterEach(() => authorStyle?.remove());

  /*
   * Acceptance 9: a single line of author CSS *outside* a layer overrides any
   * shipped rule with no `!important` and no specificity arithmetic. Every rule
   * the library ships lives inside `@layer doc.*`, and unlayered CSS wins
   * outright against layered CSS regardless of specificity.
   */
  it('beats a shipped rule with a one-word selector and no !important', () => {
    const docPage = mountPlan('<doc-note kind="info"><p>Body.</p></doc-note>');
    const note = docPage.querySelector('doc-note') as HTMLElement;

    expect(getComputedStyle(note).borderRadius).not.toBe('0px');

    authorStyle = document.createElement('style');
    authorStyle.textContent = 'doc-note { border-radius: 0; }';
    document.head.append(authorStyle);

    expect(getComputedStyle(note).borderRadius).toBe('0px');
  });

  it('accepts a token override on a subtree', () => {
    const docPage = mountPlan(
      '<doc-table style="--doc-space-unit: 9px"><table><tbody><tr><td>x</td></tr></tbody></table></doc-table>',
    );
    const table = docPage.querySelector('doc-table') as HTMLElement;

    // Custom properties inherit, so a subtree override reaches everything below
    // it and nothing above it (§6.1).
    expect(resolveLength(table, '--doc-space-4')).toBe('36px');
    expect(resolveLength(docPage, '--doc-space-4')).toBe('16px');
  });
});
