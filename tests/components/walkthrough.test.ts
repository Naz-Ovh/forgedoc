/**
 * `doc-walkthrough` — the scene player.
 *
 * What is asserted is the state the component owns: which scene is shown, the
 * cards it built, the rows and statuses on them, the outcome marks, the
 * transcript and the controls. Not how anything looks or moves (README:
 * appearance is not tested), so the animated path is awaited, never inspected.
 */

import { expect, test } from 'vitest';

import { describeStep } from '../../src/components/doc-walkthrough.js';
import { readActors, readScenes, stateAt } from '../../src/core/walkthrough.js';
import { mountPlan, mountTwice, snapshotNodes, waitFor } from '../helpers.js';

const LOGIN = `
  <doc-section title="Login">
    <doc-walkthrough title="One login, one surface">
      <doc-actor name="vendor" label="Vendor panel" kind="app" tone="cyan">browser</doc-actor>
      <doc-actor name="sessions" label="vendor_sessions" kind="table">
        <ul><li>s1 · vendor 7</li></ul>
      </doc-actor>
      <doc-actor name="admin" label="Admin route" kind="service" absent></doc-actor>
      <doc-scene title="Vendor signs in">
        <doc-move from="vendor" to="sessions" token="ub_vendor_session" result="accept"></doc-move>
        <doc-change actor="sessions" add="s2 · vendor 9" tone="good"></doc-change>
        <p>The guard finds a live session.</p>
      </doc-scene>
      <doc-scene title="Wrong door">
        <doc-change actor="admin" set="401" tone="bad"></doc-change>
        <doc-move from="vendor" to="admin" token="ub_vendor_session" result="reject"></doc-move>
        <p>An admin route never reads the vendor cookie.</p>
      </doc-scene>
      <doc-scene title="Sign out">
        <doc-change actor="sessions" remove="s1 · vendor 7"></doc-change>
        <p>Signing out deletes the row.</p>
      </doc-scene>
    </doc-walkthrough>
  </doc-section>`;

function walkthroughIn(docPage: Element): HTMLElement {
  return docPage.querySelector('doc-walkthrough') as HTMLElement;
}

function part(root: Element, name: string, nth = 0): HTMLElement {
  const found = root.querySelectorAll<HTMLElement>(`[data-part="${name}"]`)[nth];
  if (!found) throw new Error(`no [data-part="${name}"] at index ${nth}`);
  return found;
}

function card(walkthrough: Element, actor: string): HTMLElement {
  return walkthrough.querySelector(`[data-part="card"][data-actor="${actor}"]`) as HTMLElement;
}

function rowsOf(walkthrough: Element, actor: string): string[] {
  return Array.from(card(walkthrough, actor).querySelectorAll('[data-part="card-row"]')).map(
    (row) => row.textContent ?? '',
  );
}

function visibleScenes(walkthrough: Element): string[] {
  return Array.from(walkthrough.querySelectorAll<HTMLElement>(':scope > doc-scene'))
    .filter((scene) => !scene.hidden)
    .map((scene) => scene.getAttribute('title') ?? '');
}

test('builds one card per actor, one dot per scene, and shows the first scene', () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));

  expect(walkthrough.querySelectorAll('[data-part="card"]')).toHaveLength(3);
  expect(walkthrough.querySelectorAll('[data-part="dot"]')).toHaveLength(3);
  expect(visibleScenes(walkthrough)).toEqual(['Vendor signs in']);
  expect(part(walkthrough, 'counter').textContent).toBe('Scene 1 of 3');
  expect(part(walkthrough, 'prev-btn').hasAttribute('disabled')).toBe(true);
});

test('draws each card from its actor: label, note, starting rows, absence', () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));

  expect(part(card(walkthrough, 'vendor'), 'card-label').textContent).toBe('Vendor panel');
  expect(part(card(walkthrough, 'vendor'), 'card-note').textContent).toBe('browser');
  expect(rowsOf(walkthrough, 'sessions')).toEqual(['s1 · vendor 7']);
  expect(card(walkthrough, 'admin').dataset.presence).toBe('absent');
  expect(card(walkthrough, 'vendor').dataset.tone).toBe('cyan');
});

test('never moves an author node', () => {
  const holder = document.createElement('div');
  holder.innerHTML = `<doc-page doc-id="t">${LOGIN}</doc-page>`;
  const docPage = holder.firstElementChild as HTMLElement;
  const nodes = snapshotNodes(docPage);
  const parents = nodes.map((node) => node.parentNode);
  const next = nodes.map((node) => node.nextSibling);

  document.body.append(docPage);

  // Chrome is only ever added around author nodes, so each keeps its parent;
  // a following sibling may now be chrome, but never a different author node.
  nodes.forEach((node, index) => {
    expect(node.parentNode).toBe(parents[index]);
    const after = authorSibling(node);
    expect(after).toBe(next[index] === null ? null : authorSibling(next[index] as Node, true));
  });
});

/** The next sibling that is not runtime chrome (`self` includes `node` itself). */
function authorSibling(node: Node, self = false): Node | null {
  let current: Node | null = self ? node : node.nextSibling;
  while (current instanceof HTMLElement && current.dataset.docChrome !== undefined) {
    current = current.nextSibling;
  }
  return current;
}

test('a dot jumps to its scene; changes from earlier scenes have accumulated', async () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));

  part(walkthrough, 'dot', 1).click();
  expect(visibleScenes(walkthrough)).toEqual(['Wrong door']);
  expect(part(walkthrough, 'dot', 1).getAttribute('aria-current')).toBe('step');

  // Scene one's row is there from the start of scene two.
  expect(rowsOf(walkthrough, 'sessions')).toEqual(['s1 · vendor 7', 's2 · vendor 9']);

  // Scene two's own change and move land once its steps have played.
  await waitFor(() => card(walkthrough, 'admin').dataset.result === 'reject', 5000);
  expect(card(walkthrough, 'admin').dataset.presence).toBe('present');
  expect(part(card(walkthrough, 'admin'), 'card-status').textContent).toBe('401');
});

test('stepping back rebuilds the earlier state exactly', async () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));

  part(walkthrough, 'dot', 2).click();
  await waitFor(() => rowsOf(walkthrough, 'sessions').length === 2, 5000);
  part(walkthrough, 'dot', 0).click();

  expect(card(walkthrough, 'admin').dataset.presence).toBe('absent');
  await waitFor(() => rowsOf(walkthrough, 'sessions').includes('s2 · vendor 9'), 5000);
  expect(rowsOf(walkthrough, 'sessions')).toEqual(['s1 · vendor 7', 's2 · vendor 9']);
});

test('writes a plain-text transcript line per move, outcome included', async () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));

  part(walkthrough, 'next-btn').click();
  await waitFor(() => walkthrough.querySelector('[data-part="log-row"]'), 5000);

  // Changes stay on the cards; only the move, which vanishes once played, is logged.
  const rows = Array.from(walkthrough.querySelectorAll<HTMLElement>('[data-part="log-row"]'));
  expect(rows.map((row) => row.textContent)).toEqual([
    'Vendor panel → Admin route · ub_vendor_session ✕ rejected',
  ]);
  expect(rows[0]?.dataset.result).toBe('reject');
});

test('arrow keys step through scenes and stop at the ends', () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));
  const press = (key: string): void => {
    part(walkthrough, 'stage').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };

  press('ArrowRight');
  expect(visibleScenes(walkthrough)).toEqual(['Wrong door']);
  press('End');
  expect(visibleScenes(walkthrough)).toEqual(['Sign out']);
  press('ArrowRight');
  expect(visibleScenes(walkthrough)).toEqual(['Sign out']);
  press('Home');
  expect(visibleScenes(walkthrough)).toEqual(['Vendor signs in']);
});

test('Play toggles a custom state and its pressed state', () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));
  const play = part(walkthrough, 'play-btn');

  play.click();
  expect(walkthrough.matches(':state(playing)')).toBe(true);
  expect(play.getAttribute('aria-pressed')).toBe('true');

  play.click();
  expect(walkthrough.matches(':state(playing)')).toBe(false);
  expect(play.textContent).toBe('Play');
});

test('every scene names itself and takes a block comment', () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));
  const scenes = Array.from(walkthrough.querySelectorAll(':scope > doc-scene'));

  for (const scene of scenes) {
    expect(scene.querySelector('[data-part="scene-title"]')?.textContent).toBe(
      scene.getAttribute('title'),
    );
    expect(scene.querySelector('[data-part="feedback"]')?.getAttribute('aria-label')).toContain(
      'One login, one surface ›',
    );
  }
});

test('enhancing twice adds no second stage', () => {
  const walkthrough = walkthroughIn(mountTwice(LOGIN));
  expect(walkthrough.querySelectorAll('[data-part="stage"]')).toHaveLength(1);
  expect(walkthrough.querySelectorAll('[data-part="controls"]')).toHaveLength(1);
});

test('the model rebuilds any scene from scratch, striking a removed row only in its scene', () => {
  const walkthrough = walkthroughIn(mountPlan(LOGIN));
  const actors = readActors(walkthrough);
  const scenes = readScenes(walkthrough);

  expect(scenes[0]?.focus).toEqual(['vendor', 'sessions']);
  expect(stateAt(actors, scenes, -1).get('admin')?.present).toBe(false);

  const atSignOut = stateAt(actors, scenes, 2).get('sessions');
  expect(atSignOut?.rows.map((row) => [row.text, row.removedAt])).toEqual([
    ['s1 · vendor 7', 2],
    ['s2 · vendor 9', null],
  ]);
  expect(describeStep(scenes[2]?.steps[0] as never, (name) => name)).toBe(
    'sessions: − s1 · vendor 7',
  );
});
