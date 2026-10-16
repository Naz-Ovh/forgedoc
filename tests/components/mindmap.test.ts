/**
 * `doc-mindmap` and `doc-node` — what the map owns: which cards are open and
 * hidden, the chrome it builds, the tree's keyboard model, the toolbar, pan
 * and zoom, and the switch to an outline on a narrow map.
 *
 * Not where anything is drawn (README: appearance is not tested). The layout
 * maths is covered in `tests/node/mindmap.test.ts`.
 */

import { afterEach, expect, test } from 'vitest';

import { authorNodesOf, mountPlan, settle, waitFor } from '../helpers.js';

const MAP = `
  <doc-section title="Overview">
    <doc-mindmap title="Account split" expand="1">
      <doc-node title="Database" icon="database" tone="green" open>
        <p>Three account tables, <strong>one per surface</strong>.</p>
        <doc-node title="customers"></doc-node>
        <doc-node title="vendor_users" tone="cyan">Vendor staff.</doc-node>
      </doc-node>
      <doc-node title="Server" icon="server" tone="blue">
        <doc-node title="Guards"><doc-node title="authenticateVendor"></doc-node></doc-node>
        <doc-node title="Sessions"></doc-node>
      </doc-node>
      <doc-node title="Apps" closed></doc-node>
    </doc-mindmap>
  </doc-section>`;

/** Mount the map inside a box of a given width, and wait for it to pick a mode. */
async function mountMap(width: number, markup = MAP): Promise<HTMLElement> {
  const docPage = mountPlan(`<div style="width:${width}px">${markup}</div>`);
  const map = docPage.querySelector('doc-mindmap') as HTMLElement;
  await waitFor(() => map.matches(':state(map), :state(outline)'));
  return map;
}

function node(map: Element, title: string): HTMLElement {
  const found = map.querySelector(`doc-node[title="${title}"]`);
  if (!found) throw new Error(`no doc-node titled ${title}`);
  return found as HTMLElement;
}

function part(root: Element, name: string): HTMLElement {
  const found = root.querySelector(`[data-part="${name}"]`);
  if (!found) throw new Error(`no [data-part="${name}"]`);
  return found as HTMLElement;
}

const isHidden = (element: Element): boolean => element.hasAttribute('hidden');

afterEach(() => {
  for (const page of Array.from(document.querySelectorAll('doc-page'))) page.remove();
});

test('builds the title card, toolbar and one branch line per card', async () => {
  const map = await mountMap(900);

  expect(part(map, 'root-title').textContent).toBe('Account split');
  expect(part(map, 'expand-all').textContent).toBe('Expand all');
  expect(part(map, 'collapse-all').textContent).toBe('Collapse all');
  expect(part(map, 'fit').textContent).toBe('Fit');
  expect(map.querySelectorAll('[data-part="link"]')).toHaveLength(8);
  expect(map.querySelector('[data-part="link"][data-tone="cyan"]')).not.toBeNull();
});

test('gives each card a header, an icon, a title and a Comment button', async () => {
  const map = await mountMap(900);
  const database = node(map, 'Database');

  expect(part(database, 'title').textContent).toBe('Database');
  expect(
    database.querySelector(':scope > [data-part="header"] > [data-part="icon"]'),
  ).not.toBeNull();
  const comment = database.querySelector(':scope > [data-part="feedback"]');
  expect(comment?.getAttribute('aria-label')).toContain('Account split › Database');
});

test('leaves every author node where it was written', async () => {
  // Parsed but not yet connected, so nothing has been enhanced.
  const holder = document.createElement('div');
  holder.innerHTML = `<doc-page doc-id="test-plan">${MAP}</doc-page>`;
  const docPage = holder.firstElementChild as HTMLElement;
  const authored = Array.from(docPage.querySelectorAll('doc-mindmap *'));
  const parents = authored.map((element) => element.parentElement);

  document.body.append(docPage);
  await settle(50);
  expect(authored.map((element) => element.parentElement)).toEqual(parents);
  const map = docPage.querySelector('doc-mindmap') as HTMLElement;
  expect(authorNodesOf(map).filter((n) => authored.includes(n as Element))).toEqual(authored);
});

test('opens the levels `expand` asks for, and lets open and closed override it', async () => {
  const map = await mountMap(900);

  // Level 1 is visible; Database is `open`, so its children show.
  expect(isHidden(node(map, 'Database'))).toBe(false);
  expect(isHidden(node(map, 'customers'))).toBe(false);
  // Server is closed by the default depth, so its children are hidden in place.
  expect(isHidden(node(map, 'Guards'))).toBe(true);
  expect(node(map, 'Guards').getAttribute('hidden')).toBe('until-found');
  expect(node(map, 'Server').matches(':state(open)')).toBe(false);
  expect(part(node(map, 'Server'), 'toggle').textContent).toBe('+2');
  expect(part(node(map, 'Database'), 'toggle').textContent).toBe('−');
});

test('a leaf has no toggle and is not a branch', async () => {
  const map = await mountMap(900);
  const leaf = node(map, 'customers');
  expect(part(leaf, 'toggle').textContent).toBe('');
  expect(leaf.matches(':state(branch)')).toBe(false);
  expect(node(map, 'Apps').matches(':state(branch)')).toBe(false);
});

test('clicking a card with branches opens and closes it', async () => {
  const map = await mountMap(900);
  const server = node(map, 'Server');

  part(server, 'title').click();
  expect(server.matches(':state(open)')).toBe(true);
  expect(isHidden(node(map, 'Guards'))).toBe(false);

  part(server, 'title').click();
  await settle(400);
  expect(server.matches(':state(open)')).toBe(false);
  expect(isHidden(node(map, 'Guards'))).toBe(true);
});

test('a click on a link or the Comment button inside a card leaves it as it is', async () => {
  const map = await mountMap(900);
  const database = node(map, 'Database');
  (database.querySelector(':scope > [data-part="feedback"]') as HTMLElement).click();
  expect(database.matches(':state(open)')).toBe(true);
});

test('the title card closes and opens the whole map', async () => {
  const map = await mountMap(900);
  const root = part(map, 'root');
  expect(root.getAttribute('aria-expanded')).toBe('true');

  root.click();
  await settle(400);
  expect(root.getAttribute('aria-expanded')).toBe('false');
  expect(isHidden(node(map, 'Database'))).toBe(true);
  expect(part(root, 'toggle').textContent).toBe('+3');
});

test('Expand all opens every branch and Collapse all closes them again', async () => {
  const map = await mountMap(900);

  part(map, 'expand-all').click();
  await settle(400);
  expect(isHidden(node(map, 'authenticateVendor'))).toBe(false);

  part(map, 'collapse-all').click();
  await settle(400);
  expect(isHidden(node(map, 'Database'))).toBe(false);
  expect(isHidden(node(map, 'customers'))).toBe(true);
  expect(isHidden(node(map, 'Guards'))).toBe(true);
});

test('finding text in a closed branch opens the path down to it', async () => {
  const map = await mountMap(900);
  const deep = node(map, 'authenticateVendor');
  deep.dispatchEvent(new Event('beforematch', { bubbles: true }));
  expect(node(map, 'Server').matches(':state(open)')).toBe(true);
  expect(node(map, 'Guards').matches(':state(open)')).toBe(true);
});

test('arrow keys, Home, End, Enter and Space follow the tree pattern', async () => {
  const map = await mountMap(900);
  const root = part(map, 'root');
  const key = (target: Element, name: string): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  };

  root.focus();
  key(root, 'ArrowDown');
  expect(document.activeElement).toBe(node(map, 'Database'));

  key(node(map, 'Database'), 'ArrowRight');
  expect(document.activeElement).toBe(node(map, 'customers'));

  key(node(map, 'customers'), 'ArrowLeft');
  expect(document.activeElement).toBe(node(map, 'Database'));

  key(node(map, 'Database'), 'ArrowLeft');
  expect(node(map, 'Database').matches(':state(open)')).toBe(false);

  key(node(map, 'Database'), 'End');
  expect(document.activeElement).toBe(node(map, 'Apps'));

  key(node(map, 'Apps'), 'Home');
  expect(document.activeElement).toBe(root);

  const server = node(map, 'Server');
  server.focus();
  key(server, 'Enter');
  expect(server.matches(':state(open)')).toBe(true);
  key(server, ' ');
  expect(server.matches(':state(open)')).toBe(false);

  // One tab stop for the whole tree.
  const stops = [root, ...Array.from(map.querySelectorAll('doc-node'))].filter(
    (element) => (element as HTMLElement).tabIndex === 0,
  );
  expect(stops).toEqual([server]);
});

test('drags on the background pan the map; Ctrl+wheel zooms it and a plain wheel does not', async () => {
  const map = await mountMap(900);
  await settle(50);
  const pan = (): string => map.style.getPropertyValue('--doc-mm-pan-x');
  const zoom = (): string => map.style.getPropertyValue('--doc-mm-zoom');
  const start = pan();
  const rect = map.getBoundingClientRect();
  const at = (x: number): PointerEventInit => ({
    pointerId: 7,
    pointerType: 'mouse',
    button: 0,
    clientX: rect.left + x,
    clientY: rect.bottom - 10,
    bubbles: true,
  });

  map.dispatchEvent(new PointerEvent('pointerdown', at(400)));
  map.dispatchEvent(new PointerEvent('pointermove', at(460)));
  map.dispatchEvent(new PointerEvent('pointerup', at(460)));
  expect(Number.parseFloat(pan())).toBeCloseTo(Number.parseFloat(start) + 60, 0);

  const before = zoom();
  map.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
  expect(zoom()).toBe(before);
  const zoomOut = new WheelEvent('wheel', {
    deltaY: 100,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  map.dispatchEvent(zoomOut);
  expect(zoomOut.defaultPrevented).toBe(true);
  expect(Number.parseFloat(zoom())).toBeLessThan(Number.parseFloat(before));

  part(map, 'fit').click();
  await settle(400);
  expect(Number.parseFloat(zoom())).toBeLessThanOrEqual(1);
});

test('a narrow map is an outline, with the same cards and toggles', async () => {
  const map = await mountMap(390);
  expect(map.matches(':state(outline)')).toBe(true);
  expect(map.style.getPropertyValue('--doc-mm-height')).toBe('');

  const server = node(map, 'Server');
  part(server, 'title').click();
  expect(isHidden(node(map, 'Guards'))).toBe(false);
  expect(map.scrollWidth).toBeLessThanOrEqual(map.clientWidth);
});

test('a radial map and expand="all" open every card', async () => {
  const map = await mountMap(
    900,
    `<doc-mindmap title="Radial" layout="radial" expand="all">
      <doc-node title="One"><doc-node title="One a"><doc-node title="One b"></doc-node></doc-node></doc-node>
      <doc-node title="Two"></doc-node>
    </doc-mindmap>`,
  );
  expect(map.querySelectorAll('doc-node[hidden]')).toHaveLength(0);
});

test('expand="none" starts with only the title card', async () => {
  const map = await mountMap(
    900,
    `<doc-mindmap title="Closed" expand="none">
      <doc-node title="One"></doc-node><doc-node title="Two"></doc-node>
    </doc-mindmap>`,
  );
  expect(map.querySelectorAll('doc-node[hidden]')).toHaveLength(2);
  expect(part(map, 'root').getAttribute('aria-expanded')).toBe('false');
});
