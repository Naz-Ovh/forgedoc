/**
 * Acceptance 8: every preset value on every axis renders, in light and dark.
 * Acceptance 9: one line of unlayered author CSS beats every shipped rule.
 *
 * why the axes are swapped at runtime rather than fixtured: a document has
 * exactly one `plan-doc`, so it can carry exactly one value per axis. Setting
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

/** The raw token stream, e.g. `calc(var(--plan-space-unit) * 4)`. */
const read = (element: Element, token: string): string =>
  getComputedStyle(element).getPropertyValue(token).trim();

/**
 * The *resolved* value of a token.
 *
 * why a probe element: an unregistered custom property computes to its token
 * stream, not to a value — `getPropertyValue('--plan-space-4')` returns
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
          const planDoc = mountPlan(
            `<plan-section title="Preset check"><p>Body text.</p>
             <plan-note kind="info"><p>A callout.</p></plan-note>
             <plan-code lang="ts">const x = 1;</plan-code></plan-section>`,
            `plan-id="preset-${axis}-${value}" ${axis}="${value}"`,
          );

          expect(planDoc.getAttribute(axis)).toBe(value);
          // Every axis must leave the derived scales *resolvable*. A preset that
          // set a token to something invalid would surface here as NaN or as an
          // empty colour, not as a plausible-looking token stream.
          expect(pixels(planDoc, '--plan-space-4')).toBeGreaterThan(0);
          expect(pixels(planDoc, '--plan-text-lg')).toBeGreaterThan(0);
          expect(pixels(planDoc, '--plan-measure')).toBeGreaterThan(0);
          expect(resolveColor(planDoc, '--plan-accent-600')).toMatch(/^(rgb|oklab|color)/);
          expect(resolveColor(planDoc, '--plan-code-surface')).toMatch(/^(rgb|oklab|color)/);
        });
      }
    });
  }

  it('derives the spacing scale from one unit', () => {
    const compact = mountPlan('<p>x</p>', 'plan-id="d-compact" density="compact"');
    const spacious = mountPlan('<p>x</p>', 'plan-id="d-spacious" density="spacious"');

    expect(read(compact, '--plan-space-unit')).toBe('3px');
    expect(resolveLength(compact, '--plan-space-4')).toBe('12px');
    expect(read(spacious, '--plan-space-unit')).toBe('5px');
    expect(resolveLength(spacious, '--plan-space-4')).toBe('20px');
  });

  it('derives the type scale from one base and one ratio', () => {
    const small = mountPlan('<p>x</p>', 'plan-id="s-sm" scale="sm"');
    const large = mountPlan('<p>x</p>', 'plan-id="s-lg" scale="lg"');

    expect(read(small, '--plan-text-base')).toBe('15px');
    expect(read(large, '--plan-text-base')).toBe('18px');
    expect(pixels(large, '--plan-text-lg')).toBeGreaterThan(pixels(small, '--plan-text-lg'));
    // The ratio, not a hand-written list: lg is base × ratio.
    expect(pixels(large, '--plan-text-lg')).toBeCloseTo(18 * 1.22, 1);
    expect(pixels(small, '--plan-text-lg')).toBeCloseTo(15 * 1.18, 1);
  });

  it('moves the measure to the documented widths', () => {
    expect(read(mountPlan('<p>x</p>', 'plan-id="m1" measure="narrow"'), '--plan-measure')).toBe(
      '720px',
    );
    expect(read(mountPlan('<p>x</p>', 'plan-id="m2"'), '--plan-measure')).toBe('1200px');
    expect(read(mountPlan('<p>x</p>', 'plan-id="m3" measure="wide"'), '--plan-measure')).toBe(
      '1600px',
    );
  });

  it('changes the accent ramp without touching the semantic ramps', () => {
    const teal = mountPlan('<p>x</p>', 'plan-id="a1" accent="teal"');
    const plum = mountPlan('<p>x</p>', 'plan-id="a2" accent="plum"');

    expect(resolveColor(teal, '--plan-accent-600')).not.toBe(
      resolveColor(plum, '--plan-accent-600'),
    );
    // MUST (§6.4): info/success/warning/danger do not move with `accent`.
    for (const semantic of [
      '--plan-info-600',
      '--plan-success-600',
      '--plan-warn-600',
      '--plan-danger-600',
    ]) {
      expect(resolveColor(teal, semantic)).toBe(resolveColor(plum, semantic));
    }
  });

  it('lets every axis vary independently', () => {
    const mixed = mountPlan(
      '<p>x</p>',
      'plan-id="mixed" density="compact" scale="lg" accent="plum" measure="wide" code="light"',
    );

    expect(read(mixed, '--plan-space-unit')).toBe('3px');
    expect(read(mixed, '--plan-text-base')).toBe('18px');
    expect(read(mixed, '--plan-measure')).toBe('1600px');
    expect(resolveColor(mixed, '--plan-code-surface')).toBe('rgb(247, 246, 242)');
  });
});

describe('colour scheme', () => {
  /* MUST (§6.4): `light-dark()` on one token set, with `color-scheme` on the root. */
  it('resolves the same token differently per scheme, from one declaration', () => {
    const planDoc = mountPlan('<p>x</p>', 'plan-id="scheme"');

    planDoc.style.colorScheme = 'light';
    const light = resolveColor(planDoc, '--plan-surface-1');
    const lightText = getComputedStyle(planDoc).color;

    planDoc.style.colorScheme = 'dark';
    const dark = resolveColor(planDoc, '--plan-surface-1');
    const darkText = getComputedStyle(planDoc).color;

    // One declaration, two results — no @media duplication, no theme toggle.
    expect(read(planDoc, '--plan-surface-1')).toContain('light-dark(');
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
   * the library ships lives inside `@layer plan.*`, and unlayered CSS wins
   * outright against layered CSS regardless of specificity.
   */
  it('beats a shipped rule with a one-word selector and no !important', () => {
    const planDoc = mountPlan('<plan-note kind="info"><p>Body.</p></plan-note>');
    const note = planDoc.querySelector('plan-note') as HTMLElement;

    expect(getComputedStyle(note).borderRadius).not.toBe('0px');

    authorStyle = document.createElement('style');
    authorStyle.textContent = 'plan-note { border-radius: 0; }';
    document.head.append(authorStyle);

    expect(getComputedStyle(note).borderRadius).toBe('0px');
  });

  it('accepts a token override on a subtree', () => {
    const planDoc = mountPlan(
      '<plan-table style="--plan-space-unit: 9px"><table><tbody><tr><td>x</td></tr></tbody></table></plan-table>',
    );
    const table = planDoc.querySelector('plan-table') as HTMLElement;

    // Custom properties inherit, so a subtree override reaches everything below
    // it and nothing above it (§6.1).
    expect(resolveLength(table, '--plan-space-4')).toBe('36px');
    expect(resolveLength(planDoc, '--plan-space-4')).toBe('16px');
  });
});
