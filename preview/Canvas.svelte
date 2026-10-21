<script lang="ts">
  /**
   * Where the story renders: `canvas.html`, loaded once and never again.
   *
   * After the first load only the canvas's fragment changes, which
   * `canvas.ts` answers by swapping the story in place — the runtime and its
   * CSS stay loaded, so a switch repaints nothing but the component.
   *
   * why a frame at all rather than this page: the runtime pins its TOC, bucket
   * and drawers to the viewport with `position: fixed`, and lays out against
   * the viewport's width. In this page they would sit on the sidebar and size
   * themselves for the wrong width — a preview of bugs no reader ever sees.
   */

  import { untrack } from 'svelte';

  interface Props {
    story: string;
  }

  const { story }: Props = $props();

  // Set once. Changing `src` would reload the canvas; see `show` below.
  const initial = `canvas.html#${untrack(() => story)}`;

  let frame: HTMLIFrameElement;

  /** Point the loaded canvas at the current story, without reloading it. */
  function show(): void {
    // Read first: an effect tracks only what it reads, and the early return
    // below runs before the canvas has loaded.
    const hash = `#${story}`;
    const view = frame.contentWindow;
    if (!view?.location.pathname.endsWith('/canvas.html')) return;

    // Absolute on purpose: `replace()` resolves a relative URL against the
    // calling page, which is this one, not the canvas.
    const target = new URL(hash, view.location.href).href;
    if (view.location.href !== target) view.location.replace(target);
  }

  $effect(show);
</script>

<!-- `onload` covers a pick made while the canvas was still loading. -->
<iframe bind:this={frame} src={initial} title="Component canvas" onload={show}></iframe>

<style>
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
</style>
