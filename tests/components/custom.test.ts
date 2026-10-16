/**
 * `doc-custom` — the escape hatch: scoped styles, scripts that run once with
 * their block in hand, errors kept inside the block, and a comment button.
 */

import { expect, test } from 'vitest';

import { SCOPE_OPEN } from '../../src/core/scope-css.js';
import { mountPlan, settle } from '../helpers.js';

const BLOCK = `
  <doc-section title="Custom">
    <doc-custom title="Cookie jar">
      <style>.jar { gap: 4px; }</style>
      <div class="jar"><b>ub_vendor_session</b></div>
      <script type="forgedoc">
        const jar = block.querySelector('.jar');
        jar.dataset.ready = String(block.tagName === 'DOC-CUSTOM');
        jar.dataset.motion = String(typeof reducedMotion === 'boolean');
      </script>
    </doc-custom>
    <doc-custom title="Second">
      <div class="jar"></div>
      <script type="forgedoc">
        const jar = block.querySelector('.jar');
        jar.dataset.ready = 'second';
      </script>
    </doc-custom>
  </doc-section>`;

function blocks(docPage: Element): HTMLElement[] {
  return Array.from(docPage.querySelectorAll<HTMLElement>('doc-custom'));
}

test('scopes its own style to the block', () => {
  const [first] = blocks(mountPlan(BLOCK));
  expect(first?.querySelector('style')?.textContent).toContain(SCOPE_OPEN);
});

test('runs each forgedoc script once, with its own block and its own scope', async () => {
  const docPage = mountPlan(BLOCK);
  await settle(20);
  const [first, second] = blocks(docPage).map(
    (block) => block.querySelector('.jar') as HTMLElement,
  );

  // Both scripts declare `const jar` — a shared global scope would have thrown.
  expect(first?.dataset.ready).toBe('true');
  expect(first?.dataset.motion).toBe('true');
  expect(second?.dataset.ready).toBe('second');
  expect(docPage.querySelector('[data-part="script-error"]')).toBeNull();
});

test('a script that throws reports inside its block, not across the page', async () => {
  const docPage = mountPlan(`
    <doc-section title="Broken">
      <doc-custom title="Broken"><script type="forgedoc">missing.call();</script></doc-custom>
    </doc-section>`);
  await settle(20);

  const notice = docPage.querySelector('doc-custom [data-part="script-error"]');
  expect(notice?.textContent).toContain('missing');
});

test('takes a block comment named after its title', () => {
  const [first] = blocks(mountPlan(BLOCK));
  const button = first?.querySelector(':scope > [data-part="feedback"]');
  expect(button?.getAttribute('aria-label')).toBe('Comment on doc-custom · Cookie jar');
});
