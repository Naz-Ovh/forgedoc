/**
 * `doc-files` — collapsible file groups. Asserts the state the components own:
 * the generated header, the default count, and which entries are hidden.
 */

import { expect, test } from 'vitest';

import { mountPlan } from '../helpers.js';

const FILES = `
  <doc-section title="Files to change">
    <doc-files title="Files to change">
      <doc-file-group title="Database" path="packages/db" count="~9 files + 1 migration" open>
        <doc-file path="schema/user.ts">→ split into <code>customer.ts</code></doc-file>
        <doc-file path="schema/enums.ts"></doc-file>
      </doc-file-group>
      <doc-file-group title="Server modules">
        <doc-file><strong>Removed:</strong> admin product create</doc-file>
        <doc-file path="app.ts"></doc-file>
        <doc-file path="routes.ts"></doc-file>
      </doc-file-group>
    </doc-files>
  </doc-section>`;

function groups(docPage: Element): HTMLElement[] {
  return Array.from(docPage.querySelectorAll<HTMLElement>('doc-file-group'));
}

function hiddenFiles(group: Element): boolean[] {
  return Array.from(group.querySelectorAll<HTMLElement>(':scope > doc-file')).map((file) =>
    file.hasAttribute('hidden'),
  );
}

function part(root: Element, name: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(`[data-part="${name}"]`);
  if (!found) throw new Error(`no [data-part="${name}"]`);
  return found;
}

test('builds a header with title, path chip, count and toggle', () => {
  const [database] = groups(mountPlan(FILES));
  if (!database) throw new Error('no group');

  expect(part(database, 'summary-title').textContent).toBe('Database');
  expect(part(database, 'summary-path').textContent).toBe('packages/db');
  expect(part(database, 'count').textContent).toBe('~9 files + 1 migration');
  expect(part(database, 'toggle').textContent).toBe('−');
});

test('counts the entries when no count is given, and leaves out the path chip', () => {
  const [, modules] = groups(mountPlan(FILES));
  if (!modules) throw new Error('no group');

  expect(part(modules, 'count').textContent).toBe('3 files');
  expect(modules.querySelector('[data-part="summary-path"]')).toBeNull();
});

test('starts open or closed as written, and the header toggles it', () => {
  const [database, modules] = groups(mountPlan(FILES));
  if (!database || !modules) throw new Error('no group');

  expect(hiddenFiles(database)).toEqual([false, false]);
  expect(hiddenFiles(modules)).toEqual([true, true, true]);
  expect(part(modules, 'summary').getAttribute('aria-expanded')).toBe('false');

  part(modules, 'summary').click();
  expect(hiddenFiles(modules)).toEqual([false, false, false]);
  expect(modules.matches(':state(open)')).toBe(true);
  expect(part(modules, 'toggle').textContent).toBe('−');
});

test('a closed entry stays findable with Ctrl+F', () => {
  const [, modules] = groups(mountPlan(FILES));
  const file = modules?.querySelector('doc-file');
  expect(file?.getAttribute('hidden')).toBe('until-found');
});

test('puts the path chip before the note and keeps the note as written', () => {
  const docPage = mountPlan(FILES);
  const file = docPage.querySelector('doc-file') as HTMLElement;

  expect(part(file, 'path').textContent).toBe('schema/user.ts');
  expect(file.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    'schema/user.ts → split into customer.ts',
  );
  expect(file.querySelector('code:not([data-part])')?.textContent).toBe('customer.ts');
});
