/**
 * Regression: every Mermaid theme variable must be a colour Mermaid can parse,
 * in **both** colour schemes and on **every** accent.
 *
 * This is here because the first implementation shipped a diagram-shaped error
 * box in every dark-mode document. Reading `--doc-accent-tint` with
 * `getComputedStyle().getPropertyValue()` returns the token stream, so Mermaid
 * received the literal text `color-mix(in oklab, #073d36 42%, #101214)`. Fixing
 * that to resolve through a real property then produced `oklab(…)`, which
 * Mermaid also rejects. Only forcing sRGB gets there.
 *
 * Then it broke a second time, quietly. `rgb(from … r g b)` does produce sRGB,
 * but Chrome *serialises* a non-sRGB origin as `color(srgb 0.06 0.13 0.13)` —
 * which Mermaid also rejects, so every affected variable fell through to its
 * hardcoded light-mode fallback. Dark documents drew light mint node fills
 * under light body text.
 *
 * What this file guards is the *shape* of the map — a key added without a value
 * Mermaid's parser accepts — which is a functional break: Mermaid rejects the
 * variable and the diagram silently falls back or fails to draw.
 *
 * It deliberately does not check which colour comes out. That is a styling
 * question, and styling is not tested here.
 */

import { describe, expect, it } from 'vitest';

import { PRESET_AXES } from '../../src/core/contract.js';
import { themeVariables } from '../../src/vendor/mermaid.js';
import { mountPlan } from '../helpers.js';

/** The colour formats Mermaid's parser accepts. */
const PARSEABLE = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i;

/**
 * Every key the map sets, minus the handful that carry a length, a font stack
 * or an opacity. Read off the result rather than listed by hand: a variable
 * added without a matching format is exactly the bug this file exists for.
 */
function colourKeys(variables: Record<string, string>): string[] {
  const notColours = ['fontSize', 'pieOpacity'];
  return Object.keys(variables).filter((key) => !notColours.includes(key));
}

describe('Mermaid theme variables', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const accent of PRESET_AXES.accent) {
      it(`are parseable colours in ${scheme} mode on accent="${accent}"`, () => {
        const docPage = mountPlan(
          '<doc-section title="Diagram host"><p>x</p></doc-section>',
          `doc-id="mermaid-${scheme}-${accent}" accent="${accent}"`,
        );
        docPage.style.colorScheme = scheme;

        const variables = themeVariables();
        expect(colourKeys(variables).length).toBeGreaterThan(60);

        for (const key of colourKeys(variables)) {
          const value = variables[key] ?? '';
          expect(
            PARSEABLE.test(value),
            `${key} = "${value}" — Mermaid parses hex, rgb() and hsl() only`,
          ).toBe(true);
          expect(value).not.toContain('color-mix');
          expect(value).not.toContain('oklab');
          expect(value).not.toContain('light-dark');
        }

        expect(variables.fontSize).toMatch(/^[\d.]+px$/);
      });
    }
  }

  it('leaves no probe element behind', () => {
    const docPage = mountPlan('<doc-section title="x"><p>x</p></doc-section>');
    const before = docPage.childElementCount;

    themeVariables();

    expect(docPage.childElementCount).toBe(before);
    expect(docPage.querySelector('span[style*="display: none"]')).toBeNull();
  });

  it('follows the accent preset rather than hardcoding teal', () => {
    const teal = mountPlan('<p>x</p>', 'doc-id="mt-teal" accent="teal"');
    const tealVariables = themeVariables();
    teal.remove();

    mountPlan('<p>x</p>', 'doc-id="mt-plum" accent="plum"');
    const plumVariables = themeVariables();

    expect(tealVariables.primaryBorderColor).not.toBe(plumVariables.primaryBorderColor);
  });
});
