/**
 * Path chips and the editor picker: plain chips without `files-root`; with it,
 * links that open straight away in the current editor, and a corner picker
 * that changes the editor for every path on the page.
 */

import { expect, test } from 'vitest';

import { mountPlan } from '../helpers.js';

const BODY = `
  <doc-section title="Files">
    <p>See <doc-path path="apps/server/src/app.ts" line="42"></doc-path>.</p>
    <doc-files title="Files to change">
      <p>Grouped by area.</p>
      <doc-file-group title="Server" path="apps/server" open>
        <doc-file path="src/auth.ts">guards</doc-file>
      </doc-file-group>
    </doc-files>
  </doc-section>`;

const INLINE_ONLY = `
  <doc-section title="Files">
    <p>See <doc-path path="src/app.ts"></doc-path>.</p>
  </doc-section>`;

const ROOTED = 'doc-id="paths" files-root="/repo" files-wsl="Ubuntu"';

function chip(docPage: Element, tag: string): HTMLElement {
  return docPage.querySelector(
    `${tag} > [data-part="link"], ${tag} > [data-part="path"]`,
  ) as HTMLElement;
}

function part(root: Element, name: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(`[data-part="${name}"]`);
  if (!found) throw new Error(`no [data-part="${name}"]`);
  return found;
}

test('without files-root a path is a plain chip whose tooltip is the path, and no picker', () => {
  const docPage = mountPlan(BODY);
  const file = chip(docPage, 'doc-file');

  expect(file.tagName).toBe('CODE');
  expect(file.title).toBe('apps/server/src/auth.ts');
  expect(chip(docPage, 'doc-path').textContent).toBe('apps/server/src/app.ts:42');
  expect(docPage.querySelector('[data-part="editor-picker"]')).toBeNull();
});

test('with files-root every path links to VS Code until something else is chosen', () => {
  const docPage = mountPlan(BODY, ROOTED);
  const inline = chip(docPage, 'doc-path') as HTMLAnchorElement;

  expect(inline.getAttribute('href')).toBe(
    'vscode://vscode-remote/wsl+Ubuntu/repo/apps/server/src/app.ts:42:1',
  );
  expect(chip(docPage, 'doc-file').getAttribute('href')).toBe(
    'vscode://vscode-remote/wsl+Ubuntu/repo/apps/server/src/auth.ts:1:1',
  );
  // The tooltip is the resolved path, not the group's title.
  expect(chip(docPage, 'doc-file').title).toBe('/repo/apps/server/src/auth.ts');
});

test('the document default applies until the reader picks', () => {
  const docPage = mountPlan(BODY, `${ROOTED} files-editor="zed"`);
  expect(chip(docPage, 'doc-path').getAttribute('href')).toBe(
    'zed://file//wsl.localhost/Ubuntu/repo/apps/server/src/app.ts:42',
  );
});

test('the picker sits in the files surface and lists every editor', () => {
  const docPage = mountPlan(BODY, ROOTED);
  const files = docPage.querySelector('doc-files') as HTMLElement;
  const button = part(files, 'editor-button');
  const menu = part(files, 'editor-menu');

  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(button.querySelector('[data-part="editor-icon"]')).not.toBeNull();
  expect(menu.hidden).toBe(true);

  button.click();
  expect(menu.hidden).toBe(false);
  expect(button.getAttribute('aria-expanded')).toBe('true');
  const options = Array.from(menu.querySelectorAll<HTMLElement>('[data-part="editor-option"]'));
  expect(options.map((option) => option.dataset.editor)).toEqual([
    'vscode',
    'vscode-insiders',
    'cursor',
    'windsurf',
    'zed',
    'zed-linux',
    'idea',
    'none',
  ]);
  expect(options[0]?.getAttribute('aria-checked')).toBe('true');
  expect(document.activeElement).toBe(options[0]);
});

test('picking an editor saves it and re-links every path on the page', () => {
  const docPage = mountPlan(BODY, ROOTED);
  part(docPage, 'editor-button').click();
  part(docPage, 'editor-menu').querySelector<HTMLElement>('[data-editor="cursor"]')?.click();

  expect(localStorage.getItem('forgedoc:editor')).toBe('cursor');
  expect(part(docPage, 'editor-menu').hidden).toBe(true);
  expect(chip(docPage, 'doc-path').getAttribute('href')).toMatch(/^cursor:\/\/vscode-remote\//);
  expect(chip(docPage, 'doc-file').getAttribute('href')).toMatch(/^cursor:\/\/vscode-remote\//);
});

test('arrow keys move through the menu and Escape closes it back onto the button', () => {
  const docPage = mountPlan(BODY, ROOTED);
  const button = part(docPage, 'editor-button');
  const menu = part(docPage, 'editor-menu');
  button.click();

  const key = (name: string): void => {
    (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true }),
    );
  };
  key('ArrowDown');
  expect((document.activeElement as HTMLElement).dataset.editor).toBe('vscode-insiders');
  key('End');
  expect((document.activeElement as HTMLElement).dataset.editor).toBe('none');
  key('Escape');
  expect(menu.hidden).toBe(true);
  expect(document.activeElement).toBe(button);
});

test('"copy" keeps the chip a link but copies instead of navigating', () => {
  localStorage.setItem('forgedoc:editor', 'none');
  const docPage = mountPlan(BODY, ROOTED);
  const link = chip(docPage, 'doc-file') as HTMLAnchorElement;
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });

  link.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  expect(link.title).toBe('Copy /repo/apps/server/src/auth.ts');
});

test('a page with only inline paths gets the picker in its corner', () => {
  const docPage = mountPlan(INLINE_ONLY, ROOTED);
  const pickers = docPage.querySelectorAll<HTMLElement>('[data-part="editor-picker"]');

  expect(pickers).toHaveLength(1);
  expect(pickers[0]?.dataset.placement).toBe('page');
});
