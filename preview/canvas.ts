/**
 * The canvas: one story at a time, alone inside a `<doc-page>`.
 *
 * `canvas.html#doc-mindmap` shows `stories/doc-mindmap.html` and nothing else.
 * The browser app (`Canvas.svelte`) loads it once and switches stories by
 * changing only the fragment; opened directly, it is the bare page.
 *
 * The runtime loads once, with this module, so its CSS is in place before the
 * first story mounts and stays there. A switch replaces the `doc-page` and
 * nothing else — no reload, no unstyled paint.
 */

import '../src/index.js';

import { loadStory } from './stories.js';

const PAGE_ATTRIBUTES =
  'density="comfortable" scale="md" accent="teal" measure="default" code="auto"';

let load = loadStory;
let latest = 0;

const current = (): string => decodeURIComponent(location.hash.slice(1));

function notFound(name: string): HTMLElement {
  const note = document.createElement('p');
  note.textContent = name
    ? `No story at preview/stories/${name}.html.`
    : 'Name a story in the URL: canvas.html#doc-mindmap.';
  return note;
}

/**
 * Replace the shown `doc-page` with a fresh one holding `name`'s story.
 *
 * why build it detached and attach it whole (§5.2): elements then upgrade once,
 * in tree order, with all of their children present — the delivery contract,
 * and how `tests/helpers.ts` mounts a page. A new `doc-page` rather than new
 * children, because one owns its store, TOC and bucket for its whole life.
 */
async function show(name: string): Promise<void> {
  const ticket = ++latest;
  const pending = load(name);
  const markup = pending ? await pending : undefined;
  if (ticket !== latest) return;

  // A namespace per story, so an answer given on one never shows up on another.
  const docId = markup === undefined ? 'preview-none' : `preview-${name}`;
  const holder = document.createElement('div');
  holder.innerHTML = `<doc-page doc-id="${docId}" ${PAGE_ATTRIBUTES}>${markup ?? ''}</doc-page>`;
  const docPage = holder.firstElementChild as HTMLElement;
  if (markup === undefined) docPage.append(notFound(name));

  const shown = document.querySelector('doc-page');
  if (shown) shown.replaceWith(docPage);
  else document.body.append(docPage);
  document.title = `${name} — ForgeDoc preview`;
}

window.addEventListener('hashchange', () => {
  void show(current()).then(() => window.scrollTo(0, 0));
});
await show(current());

if (import.meta.hot) {
  // An edited story re-mounts in place, keeping the scroll position.
  import.meta.hot.accept('./stories.js', (module) => {
    if (!module) return;
    load = module.loadStory as typeof loadStory;
    void show(current());
  });

  // A runtime change cannot be patched in: a custom element cannot be
  // redefined. Reload the canvas only; the app around it stays as it is.
  import.meta.hot.accept('../src/index.js', () => location.reload());
}
