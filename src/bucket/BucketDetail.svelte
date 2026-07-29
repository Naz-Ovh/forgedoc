<script lang="ts">
  /**
   * The detail window: what the document says, beside what the reader said.
   *
   * Deliberately large and modal-ish. A reader opens this to check one specific
   * thing they wrote, often against a paragraph they only half remember, and a
   * cramped popover makes that comparison impossible — which is why clicking a
   * collected item opens this instead of scrolling the page away underneath the
   * panel.
   */
  import type { DetailView } from './detail.js';

  interface Props {
    view: DetailView;
    onClose: () => void;
    onReveal: () => void;
    onRemove: () => void;
  }

  const { view, onClose, onReveal, onRemove }: Props = $props();

  /** Escape closes, exactly as it does for the contents panel. */
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div data-part="detail-backdrop" data-plan-ui onclick={onClose}></div>

<div
  data-part="detail"
  data-plan-ui
  data-kind={view.kind}
  role="dialog"
  aria-modal="true"
  aria-label={view.kind === 'answer' ? 'Answer detail' : 'Comment detail'}
>
  <header data-part="detail-header">
    <div data-part="detail-heading">
      <span data-part="detail-kind">{view.kind === 'answer' ? 'Answer' : 'Comment'}</span>
      {#if view.at}
        <span data-part="detail-at">{view.at}</span>
      {/if}
    </div>
    <button data-part="detail-close" type="button" aria-label="Close" onclick={onClose}>✕</button>
  </header>

  <h2 data-part="detail-title">{view.title}</h2>

  <div data-part="detail-panes">
    <article data-part="detail-pane" data-side="document">
      <h3 data-part="detail-pane-title">In the document</h3>

      {#if view.orphaned}
        <p data-part="detail-orphaned">
          The text this was attached to is no longer in the document. Your comment is kept, and it
          still goes into the bucket.
        </p>
      {/if}

      {#if view.kind === 'answer'}
        <ul data-part="detail-options">
          {#each view.options as option, index (index)}
            <li data-part="detail-option" data-chosen={option.chosen ? '' : undefined}>
              <span data-part="detail-option-mark" aria-hidden="true"></span>
              <span data-part="detail-option-label">{option.label}</span>
            </li>
          {/each}
        </ul>
      {:else if view.scope === 'block'}
        <pre data-part="detail-block">{view.blockContent || 'This block has no text content.'}</pre>
      {:else if view.context}
        <!--
          `<mark>` here is not the thing §10.2 forbids. That MUST is about
          painting the *document* — wrapping a live selection invalidates every
          offset captured after it. This is a copy of the text inside a dialog
          the runtime built, where `<mark>` is simply the correct element.
        -->
        <p data-part="detail-context">
          <span data-part="detail-before">{view.context.before}</span><mark
            data-part="detail-quote">{view.context.quote}</mark
          ><span data-part="detail-after">{view.context.after}</span>
        </p>
      {/if}
    </article>

    <article data-part="detail-pane" data-side="feedback">
      <h3 data-part="detail-pane-title">
        {view.kind === 'answer' ? 'You chose' : 'You said'}
      </h3>
      <p data-part="detail-feedback">{view.feedback}</p>

      {#if view.note}
        <h3 data-part="detail-pane-title">Your note</h3>
        <p data-part="detail-note">{view.note}</p>
      {/if}
    </article>
  </div>

  <footer data-part="detail-actions">
    <button data-part="detail-reveal" type="button" onclick={onReveal} disabled={view.orphaned}>
      Go to it in the document
    </button>
    <button data-part="detail-remove" type="button" onclick={onRemove}>Remove</button>
    <button data-part="detail-done" type="button" onclick={onClose}>Close</button>
  </footer>
</div>

<!--
  No <style> block, deliberately — see bucket.css and §10.1.
-->
