<script lang="ts">
  /**
   * One row in the review panel.
   *
   * Kept separate from the panel because the list is the part that re-renders
   * constantly — this is exactly the "genuinely stateful reactive UI" that
   * justifies Svelte for the bucket and nothing else (§10.1).
   */
  interface Props {
    index: number;
    kind: 'answer' | 'comment';
    /** Question text, or the quoted excerpt. */
    heading: string;
    /** Chosen labels, or the reader's comment. */
    body: string;
    /** Human-readable location, e.g. `3.1 Data model`. */
    at: string;
    orphaned: boolean;
    /**
     * Open the detail window.
     *
     * why this is not "scroll to it": scrolling the document out from under the
     * panel answers the wrong question. A reader clicking one of their own items
     * is checking what they said against what the document says, and that
     * comparison needs both on screen at once — so the row opens the detail
     * window, and *that* offers the jump.
     */
    onOpen: () => void;
    onRemove: () => void;
  }

  const { index, kind, heading, body, at, orphaned, onOpen, onRemove }: Props = $props();
</script>

<li data-part="bucket-item" data-kind={kind} data-orphaned={orphaned ? '' : undefined}>
  <button data-part="bucket-item-body" type="button" onclick={onOpen}>
    <span data-part="bucket-item-index">{index}</span>
    <span data-part="bucket-item-text">
      <span data-part="bucket-item-heading">{heading}</span>
      <span data-part="bucket-item-answer">{body}</span>
      {#if at}
        <span data-part="bucket-item-at">{at}</span>
      {/if}
      {#if orphaned}
        <span data-part="bucket-item-orphaned">
          The text this comment was attached to is no longer in the document.
        </span>
      {/if}
    </span>
  </button>

  <button
    data-part="bucket-item-remove"
    type="button"
    aria-label="Remove this item"
    onclick={onRemove}
  >
    ✕
  </button>
</li>

<!--
  No <style> block, deliberately.

  why (§10.1): the panel's styles live in `styles/components/bucket.css` inside
  `@layer doc.components`, where the `--doc-*` tokens reach them and where an
  author's unlayered CSS still beats them. Svelte's component styles would be
  scoped behind a generated hash and sit outside that cascade — and in custom
  element mode Svelte inlines them as a JavaScript string rather than emitting
  CSS at all, which is the specific trap mounting as a normal component avoids.
-->
