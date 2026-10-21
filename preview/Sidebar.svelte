<script lang="ts">
  /**
   * Every story, in the groups and order of `REFERENCE.md`. A tag with no
   * story yet is listed muted, so the gap is visible.
   */

  import type { Group } from './catalog.js';

  interface Props {
    groups: readonly Group[];
    current: string;
  }

  const { groups, current }: Props = $props();

  let nav: HTMLElement;

  // Keep the selected entry in view when the selection comes from the URL.
  $effect(() => {
    void current;
    nav.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  });
</script>

<nav bind:this={nav} aria-label="Components">
  <p class="brand">ForgeDoc <span>components</span></p>

  {#each groups as group (group.title)}
    <section>
      <h2>{group.title}</h2>
      {#each group.entries as entry (entry.name)}
        {#if entry.hasStory}
          <a
            class="item"
            href="#{entry.name}"
            aria-current={entry.name === current ? 'page' : undefined}
          >{entry.name}</a>
        {:else}
          <span class="item missing" title="No story yet — add preview/stories/{entry.name}.html"
            >{entry.name}</span
          >
        {/if}
      {/each}
    </section>
  {/each}
</nav>

<style>
  nav {
    overflow-y: auto;
    padding: 16px 12px 32px;
    border-right: 1px solid var(--shell-border);
    background: var(--shell-panel);
  }

  .brand {
    margin: 0 8px 16px;
    font-weight: 650;
  }

  .brand span {
    color: var(--shell-muted);
    font-weight: 400;
  }

  section {
    margin-bottom: 16px;
  }

  h2 {
    margin: 0 8px 4px;
    color: var(--shell-muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .item {
    display: block;
    padding: 4px 8px;
    border-radius: 6px;
    color: inherit;
    font: 13px / 1.5 var(--shell-mono);
    text-decoration: none;
  }

  a.item:hover {
    background: var(--shell-hover);
  }

  a.item[aria-current='page'] {
    background: var(--shell-accent-tint);
    color: var(--shell-accent);
    font-weight: 600;
  }

  .missing {
    color: var(--shell-muted);
    opacity: 0.6;
    cursor: help;
  }

  @media (max-width: 720px) {
    nav {
      max-height: 35vh;
      border-right: 0;
      border-bottom: 1px solid var(--shell-border);
    }
  }
</style>
