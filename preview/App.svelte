<script lang="ts">
  /**
   * The component browser: a sidebar of stories, a toolbar naming the one
   * shown, and the canvas that renders it.
   *
   * The URL hash is the selection, so `/preview/#doc-mindmap` links straight
   * to a story. This page never navigates; picking a story only changes the
   * hash, and the canvas swaps it in place.
   */

  import Canvas from './Canvas.svelte';
  import { hasStory, storyGroups } from './catalog.js';
  import Sidebar from './Sidebar.svelte';
  import Toolbar from './Toolbar.svelte';

  const groups = storyGroups();
  const first = groups.flatMap(({ entries }) => entries).find(({ hasStory }) => hasStory)?.name;

  /** The story the hash names, or the first one when it names none. */
  function fromHash(): string {
    const requested = decodeURIComponent(location.hash.slice(1));
    return hasStory(requested) ? requested : (first ?? '');
  }

  let story = $state(fromHash());

  $effect(() => {
    if (location.hash !== `#${story}`) history.replaceState(null, '', `#${story}`);
    document.title = `${story} — ForgeDoc components`;
  });
</script>

<svelte:window onhashchange={() => (story = fromHash())} />

<Sidebar {groups} current={story} />

<main>
  <Toolbar {story} />
  <Canvas {story} />
</main>

<style>
  :global(:root) {
    --shell-bg: #ffffff;
    --shell-panel: #f6f7f9;
    --shell-text: #1c2024;
    --shell-muted: #60646c;
    --shell-border: #e0e1e6;
    --shell-hover: #ebedf0;
    --shell-accent: #0d7d6c;
    --shell-accent-tint: #e0f4f0;
    --shell-mono: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;

    color-scheme: light dark;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --shell-bg: #111113;
      --shell-panel: #18191b;
      --shell-text: #edeef0;
      --shell-muted: #9a9ca3;
      --shell-border: #2b2d31;
      --shell-hover: #222326;
      --shell-accent: #3dd6b9;
      --shell-accent-tint: #0f2e29;
    }
  }

  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    height: 100vh;
    margin: 0;
    background: var(--shell-bg);
    color: var(--shell-text);
    font: 14px / 1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
  }

  main {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
  }

  @media (max-width: 720px) {
    :global(body) {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }
  }
</style>
