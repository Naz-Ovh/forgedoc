<script lang="ts">
  /** The shown story's tag, its contract description, and the child tags it includes. */

  import { childrenOf, describe } from './catalog.js';

  interface Props {
    story: string;
  }

  const { story }: Props = $props();

  const parts = $derived(describe(story));
  const children = $derived(childrenOf(story));
</script>

<header>
  <div class="summary">
    <code class="tag">&lt;{story}&gt;</code>
    <p>
      {#each parts as part, index (index)}{#if part.code}<code>{part.text}</code>{:else}{part.text}{/if}{/each}
      {#if children.length > 0}
        Also shows {#each children as child, index (child)}{index > 0 ? ', ' : ''}<code>{child}</code>{/each}.
      {/if}
    </p>
  </div>
  <a href="canvas.html#{story}" target="_blank" rel="noopener">Open alone ↗</a>
</header>

<style>
  header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    border-bottom: 1px solid var(--shell-border);
  }

  .summary {
    min-width: 0;
  }

  .tag {
    font: 600 14px / 1.4 var(--shell-mono);
  }

  p {
    margin: 2px 0 0;
    color: var(--shell-muted);
    font-size: 13px;
  }

  p code {
    font: 12px var(--shell-mono);
  }

  a {
    flex: none;
    color: var(--shell-accent);
    font-size: 13px;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>
