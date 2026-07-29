/**
 * Regression: every Mermaid theme variable must be a colour Mermaid can parse,
 * in **both** colour schemes and on **every** accent.
 *
 * This is here because the first implementation shipped a diagram-shaped error
 * box in every dark-mode document. Reading `--plan-accent-tint` with
 * `getComputedStyle().getPropertyValue()` returns the token stream, so Mermaid
 * received the literal text `color-mix(in oklab, #073d36 42%, #101214)`. Fixing
 * that to resolve through a real property then produced `oklab(…)`, which
 * Mermaid also rejects. Only forcing sRGB gets there.
 */

import { describe, expect, it } from 'vitest';

import { PRESET_AXES } from '../../src/core/contract.js';
import { themeVariables } from '../../src/vendor/mermaid.js';
import { mountPlan } from '../helpers.js';

/** The colour formats Mermaid's parser accepts. */
const PARSEABLE = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i;

/** Theme variables that carry a colour rather than a length or a font stack. */
const COLOUR_KEYS = [
  'background',
  'primaryColor',
  'primaryTextColor',
  'primaryBorderColor',
  'lineColor',
  'secondaryColor',
  'tertiaryColor',
  'textColor',
  'mainBkg',
  'nodeBorder',
  'clusterBkg',
];

describe('Mermaid theme variables', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const accent of PRESET_AXES.accent) {
      it(`are parseable colours in ${scheme} mode on accent="${accent}"`, () => {
        const planDoc = mountPlan(
          '<plan-section title="Diagram host"><p>x</p></plan-section>',
          `plan-id="mermaid-${scheme}-${accent}" accent="${accent}"`,
        );
        planDoc.style.colorScheme = scheme;

        const variables = themeVariables();

        for (const key of COLOUR_KEYS) {
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
    const planDoc = mountPlan('<plan-section title="x"><p>x</p></plan-section>');
    const before = planDoc.childElementCount;

    themeVariables();

    expect(planDoc.childElementCount).toBe(before);
    expect(planDoc.querySelector('span[style*="display: none"]')).toBeNull();
  });

  it('follows the accent preset rather than hardcoding teal', () => {
    const teal = mountPlan('<p>x</p>', 'plan-id="mt-teal" accent="teal"');
    const tealVariables = themeVariables();
    teal.remove();

    mountPlan('<p>x</p>', 'plan-id="mt-plum" accent="plum"');
    const plumVariables = themeVariables();

    expect(tealVariables.primaryBorderColor).not.toBe(plumVariables.primaryBorderColor);
  });
});
