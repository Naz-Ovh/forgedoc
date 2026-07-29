/**
 * The contents panel: floating by default, docked on request.
 *
 * The three regressions this file exists for are all layout bugs that no amount
 * of reading the CSS would have caught — they only showed up on screen:
 *
 *   1. The panel was appended without `data-plan-chrome`, so the reading-column
 *      rule matched it. That rule out-specifies `plan-toc`'s own `max-width`, so
 *      a "15rem" panel rendered at 90% of the viewport and covered the document.
 *   2. It opened itself on load at ≥1280px, hiding the first screen of the very
 *      document the reader had just opened.
 *   3. Docking and collapsing were one flag, so there was no way to have the
 *      panel *push* the content aside rather than float over it.
 */

import { describe, expect, it } from 'vitest';
import type { PlanDoc } from '../../src/components/plan-doc.js';
import { storeFor } from '../../src/core/store.js';
import { mountPlan, settle } from '../helpers.js';

const DOCUMENT = `
  <plan-section title="What we are building">
    <p>A component library for AI-authored planning documents.</p>
    <plan-section title="Scope boundaries"><p>In scope.</p></plan-section>
  </plan-section>
  <plan-section title="Open questions"><p>Two of them.</p></plan-section>
`;

const toc = (planDoc: Element): HTMLElement => planDoc.querySelector('plan-toc') as HTMLElement;
const toggle = (planDoc: Element): HTMLElement =>
  planDoc.querySelector('plan-toc [data-part="toggle"]') as HTMLElement;
const dock = (planDoc: Element): HTMLElement =>
  planDoc.querySelector('plan-toc [data-part="dock"]') as HTMLElement;

/**
 * The browser these run in is 414px wide — narrower than the dock breakpoint.
 *
 * Asserted rather than assumed, so that the two tests below which depend on it
 * fail loudly if the harness viewport ever changes, instead of quietly passing
 * for the wrong reason. The wide branch is covered by the Playwright test
 * `a docked contents panel pushes the column and re-centres it`, at 1440px.
 */
const NARROW = !window.matchMedia('(min-width: 1280px)').matches;

describe('the contents panel', () => {
  it('opts out of the reading column', () => {
    const planDoc = mountPlan(DOCUMENT);

    // MUST (§8.1): chrome is a sibling of the content, not part of the column.
    // Without this marker `plan-doc > *:not([data-plan-chrome])` matches the
    // panel at (0,1,1) and beats `plan-toc` at (0,0,1) — which is exactly how a
    // 15rem panel ended up 90% of the viewport wide.
    expect(toc(planDoc).dataset.planChrome).toBe('');
    expect(toc(planDoc).dataset.part).toBe('toc');
  });

  it('starts floating and collapsed', () => {
    const planDoc = mountPlan(DOCUMENT);

    expect(planDoc.matches(':state(toc-open)')).toBe(false);
    expect(planDoc.matches(':state(toc-docked)')).toBe(false);
    expect(toggle(planDoc).getAttribute('aria-expanded')).toBe('false');
  });

  it('opens and collapses from its own toggle', () => {
    const planDoc = mountPlan(DOCUMENT);

    toggle(planDoc).click();
    expect(planDoc.matches(':state(toc-open)')).toBe(true);
    expect(toggle(planDoc).getAttribute('aria-expanded')).toBe('true');

    toggle(planDoc).click();
    expect(planDoc.matches(':state(toc-open)')).toBe(false);
  });

  it('docks and floats from the dock control, and docking implies open', () => {
    const planDoc = mountPlan(DOCUMENT);
    dock(planDoc).click();
    expect(planDoc.matches(':state(toc-docked)')).toBe(true);
    expect(planDoc.matches(':state(toc-open)')).toBe(true);
    expect(dock(planDoc).getAttribute('aria-pressed')).toBe('true');

    dock(planDoc).click();
    expect(planDoc.matches(':state(toc-docked)')).toBe(false);
    expect(planDoc.matches(':state(toc-open)')).toBe(true);
  });

  it('collapsing a docked panel also floats it', () => {
    const planDoc = mountPlan(DOCUMENT);
    dock(planDoc).click();
    toggle(planDoc).click();

    // A docked-but-collapsed rail would push the reading column aside to show
    // one word, so the two flags are resolved together in `PlanDoc#setToc`.
    expect(planDoc.matches(':state(toc-open)')).toBe(false);
    expect(planDoc.matches(':state(toc-docked)')).toBe(false);
  });

  it('remembers the reader’s choice across a reload', async () => {
    const first = mountPlan(DOCUMENT);
    toggle(first).click();
    await settle();
    expect(storeFor(first).get('toc')).toEqual({ open: true, docked: false });
    first.remove();

    const second = mountPlan(DOCUMENT);
    expect(second.matches(':state(toc-open)')).toBe(true);
  });

  it('presents a remembered dock as the collapsed pill when there is no room', async () => {
    expect(NARROW, 'this test asserts the narrow branch').toBe(true);

    const first = mountPlan(DOCUMENT);
    dock(first).click();
    await settle();
    expect(storeFor(first).get('toc')).toEqual({ open: true, docked: true });
    first.remove();

    // The preference is kept — a phone should not erase a choice made on a
    // desktop — but a rail with no column to occupy would be a full-height
    // overlay across the first screen of the document.
    const second = mountPlan(DOCUMENT);
    expect(second.matches(':state(toc-docked)')).toBe(false);
    expect(second.matches(':state(toc-open)')).toBe(false);
    expect(storeFor(second).get('toc')).toEqual({ open: true, docked: true });
  });

  it('lets the author pin a state, which then ignores what was stored', () => {
    const stored = mountPlan(DOCUMENT);
    stored.remove();

    const closed = mountPlan(DOCUMENT, 'plan-id="test-plan" toc="closed"');
    expect(closed.matches(':state(toc-open)')).toBe(false);
    closed.remove();

    const open = mountPlan(DOCUMENT, 'plan-id="test-plan" toc="open"');
    expect(open.matches(':state(toc-open)')).toBe(true);
    expect(open.matches(':state(toc-docked)')).toBe(false);
    open.remove();

    // `toc="docked"` follows the same width rule as a remembered dock.
    expect(NARROW).toBe(true);
    const docked = mountPlan(DOCUMENT, 'plan-id="test-plan" toc="docked"');
    expect(docked.matches(':state(toc-docked)')).toBe(false);
    expect(docked.matches(':state(toc-open)')).toBe(false);
  });

  it('omits the panel entirely for toc="off"', () => {
    const planDoc = mountPlan(DOCUMENT, 'plan-id="test-plan" toc="off"');
    expect(planDoc.querySelector('plan-toc')).toBeNull();
  });

  it('gets out of the way when a floating entry is clicked', () => {
    const planDoc = mountPlan(DOCUMENT);

    toggle(planDoc).click();
    (planDoc.querySelector('plan-toc [data-part="entry"]') as HTMLElement).click();
    expect(planDoc.matches(':state(toc-open)')).toBe(false);
  });

  it('stays put when a docked entry is clicked', () => {
    const planDoc = mountPlan(DOCUMENT);
    dock(planDoc).click();
    (planDoc.querySelector('plan-toc [data-part="entry"]') as HTMLElement).click();
    expect(planDoc.matches(':state(toc-docked)')).toBe(true);
    expect(planDoc.matches(':state(toc-open)')).toBe(true);
  });

  it('closes a floating panel on Escape, but leaves a docked one alone', () => {
    const planDoc = mountPlan(DOCUMENT);
    const pressEscape = (): void =>
      void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    toggle(planDoc).click();
    pressEscape();
    expect(planDoc.matches(':state(toc-open)')).toBe(false);

    dock(planDoc).click();
    pressEscape();
    expect(planDoc.matches(':state(toc-docked)')).toBe(true);
  });

  it('exposes its state as read-only getters for the panel’s controls', () => {
    const planDoc = mountPlan(DOCUMENT) as PlanDoc;

    expect(planDoc.tocOpen).toBe(false);
    planDoc.toggleToc(true);
    expect(planDoc.tocOpen).toBe(true);
    expect(planDoc.tocDocked).toBe(false);
  });
});
