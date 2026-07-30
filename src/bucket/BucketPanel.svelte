<script lang="ts">
  /**
   * The feedback bucket — the one Svelte component in the library (§10).
   *
   * Everything here is runtime-created DOM: the floating trigger, the review
   * panel, the selection composer and the detail window. There is no author
   * content to preserve, so §2.2 does not apply; no slots are needed, so the
   * Svelte light-DOM slot limitation is irrelevant; and it is genuinely stateful
   * reactive UI, which is what Svelte is for.
   */
  
  import { BLOCK_FEEDBACK_EVENT, type BlockFeedbackDetail } from '../core/feedback.js';
  import type { DocState, DocStore, FeedbackItem } from '../core/types.js';
import BucketDetail from './BucketDetail.svelte';
  import BucketItem from './BucketItem.svelte';
  import { clearBucket, collectAnswers, collectBucket, timestampNow } from './collect.js';
  import { type DetailView, detailForAnswer, detailForComment } from './detail.js';
  import {
    findOrphans,
    highlightApi,
    locationLabel,
    paintHighlights,
    revealFeedback,
    type SelectionEvent,
    watchSelection,
  } from './selection.js';
  import { serializeBucket } from './serialize.js';

  interface Props {
    docPage: HTMLElement;
    store: DocStore;
  }

  const { docPage, store }: Props = $props();

  let panelOpen = $state(false);
  let pendingSelection = $state<SelectionEvent | null>(null);
  let draftComment = $state('');
  let copyLabel = $state('Copy');
  /** Id of the item whose detail window is open, or null. */
  let openDetailId = $state<string | null>(null);
  let composer = $state<HTMLTextAreaElement | null>(null);

  const hasHighlightApi = highlightApi() !== null;

  /*
   * `$store` — the store contract in §9.2 exists precisely so this works with
   * zero glue. `subscribe` calls the subscriber immediately and returns its own
   * unsubscribe function, which is exactly what Svelte requires, so there is no
   * adapter, no wrapper store and no manual lifecycle here.
   */
  const docState = $derived<DocState>($store);

  $effect(() => watchSelection(docPage, (event) => (pendingSelection = event)));

  /*
   * A block's own button opens the same composer as a text selection.
   *
   * why an event rather than the components calling in: `doc-figure` should not
   * know the bucket exists, and the bucket should not have to enumerate which
   * tags can be commented on. One bubbling event and neither side has to change
   * when the other does.
   */
  $effect(() => {
    const handler = (event: Event): void => {
      const block = (event as CustomEvent<BlockFeedbackDetail>).detail;
      const element = docPage.querySelector(`#${CSS.escape(block.anchorId)}`);

      draftComment = '';
      pendingSelection = {
        range: { anchorId: block.anchorId, start: 0, end: 0, quote: block.label },
        rect: block.rect,
        at: locationLabel(element ?? docPage),
        scope: 'block',
      };
    };

    docPage.addEventListener(BLOCK_FEEDBACK_EVENT, handler);
    return () => docPage.removeEventListener(BLOCK_FEEDBACK_EVENT, handler);
  });

  // Repaint whenever the feedback list, the open detail or the draft changes.
  $effect(() => {
    paintHighlights(docPage, docState.feedback, {
      activeId: openDetailId,
      pending: pendingSelection
        ? { range: pendingSelection.range, scope: pendingSelection.scope }
        : null,
    });
  });

  // Focusing the textarea collapses the document selection, which is why the
  // range is serialised before the composer opens and painted as a pending
  // highlight while it is up.
  $effect(() => {
    if (pendingSelection && composer) composer.focus();
  });

  const answers = $derived(collectAnswers(docPage, docState));
  const comments = $derived(docState.feedback);
  const count = $derived(answers.length + comments.length);
  // Anchors that no longer resolve are flagged in the list rather than dropped —
  // a comment the reader wrote is never silently discarded (§9.1).
  const orphanedIds = $derived(findOrphans(docPage, docState.feedback));

  const detail = $derived.by<DetailView | null>(() => {
    if (openDetailId === null) return null;

    const answer = answers.find((candidate) => candidate.anchorId === openDetailId);
    if (answer) return detailForAnswer(docPage, answer, docState);

    const comment = comments.find((candidate) => candidate.id === openDetailId);
    if (comment) return detailForComment(docPage, comment, orphanedIds.includes(comment.id));

    // The item was removed while its window was open.
    return null;
  });

  function saveComment(): void {
    const selection = pendingSelection;
    const text = draftComment.trim();
    if (!selection || text === '') return;

    const item: FeedbackItem = {
      id: `fb-${selection.range.anchorId}-${selection.range.start}-${docState.feedback.length}`,
      createdAt: timestampNow(),
      range: selection.range,
      comment: text,
      at: selection.at,
      ...(selection.scope === 'block' ? { scope: 'block' as const } : {}),
    };

    store.set('feedback', [...docState.feedback, item]);
    cancelComment();
  }

  function cancelComment(): void {
    draftComment = '';
    pendingSelection = null;
    window.getSelection()?.removeAllRanges();
  }

  /** ⌘/Ctrl + Enter saves; Escape abandons. Both are muscle memory. */
  function onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      saveComment();
      return;
    }
    if (event.key === 'Escape') cancelComment();
  }

  function removeAnswer(anchorId: string): void {
    const remaining = { ...docState.answers };
    delete remaining[anchorId];
    store.set('answers', remaining);
    if (openDetailId === anchorId) openDetailId = null;
  }

  function removeComment(id: string): void {
    store.set(
      'feedback',
      docState.feedback.filter((item) => item.id !== id),
    );
    if (openDetailId === id) openDetailId = null;
  }

  /** Scroll to whatever a detail window is about, and close the window. */
  function reveal(view: DetailView): void {
    openDetailId = null;

    if (view.kind === 'comment') {
      revealFeedback(docPage, docState.feedback, view.id);
      return;
    }
    docPage
      .querySelector(`#${CSS.escape(view.anchorId)}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function removeFromDetail(view: DetailView): void {
    if (view.kind === 'answer') {
      removeAnswer(view.anchorId);
      return;
    }
    removeComment(view.id);
  }

  async function copy(alsoClear: boolean): Promise<void> {
    const text = serializeBucket(collectBucket(docPage, docState, timestampNow()));
    try {
      await navigator.clipboard.writeText(text);
      copyLabel = alsoClear ? 'Copied & cleared' : 'Copied';
    } catch {
      copyLabel = 'Press ⌘C';
    }
    if (alsoClear) clearBucket(store);
    setTimeout(() => (copyLabel = 'Copy'), 1600);
  }
</script>

<!--
  MUST (§8.8): the whole bucket is hidden in print. See print.css.

  `data-doc-ui` marks every part of it as the runtime's own interface. The
  selection watcher ignores events from inside it — without that, clicking into
  the composer reads as "the reader selected nothing" and closes the composer
  before a single character can be typed.
-->
<div data-part="bucket-root" data-doc-ui data-open={panelOpen ? '' : undefined}>
  <button
    data-part="bucket-trigger"
    type="button"
    aria-expanded={panelOpen}
    onclick={() => (panelOpen = !panelOpen)}
  >
    <span data-part="bucket-trigger-label">Feedback</span>
    <span data-part="bucket-count">{count}</span>
  </button>

  {#if panelOpen}
    <section data-part="bucket-panel" aria-label="Feedback review">
      <header data-part="bucket-header">
        <span data-part="bucket-title">Your feedback</span>
        <button
          data-part="bucket-close"
          type="button"
          aria-label="Close"
          onclick={() => (panelOpen = false)}
        >
          ✕
        </button>
      </header>

      {#if !store.available}
        <p data-part="bucket-warning">
          Your answers won’t survive a reload — use Copy before closing.
        </p>
      {/if}

      {#if !hasHighlightApi}
        <p data-part="bucket-warning">
          This browser has no CSS Custom Highlight API, so highlights use a simpler fallback.
        </p>
      {/if}

      {#if count === 0}
        <p data-part="bucket-empty">
          Answer a question, select any text in the document, or use the Comment button on a
          diagram or code block.
        </p>
      {:else}
        <ol data-part="bucket-list">
          {#each answers as answer, index (answer.anchorId)}
            <BucketItem
              index={index + 1}
              kind="answer"
              heading={answer.question}
              body={answer.labels.join(' · ')}
              at={answer.note ? `Note: ${answer.note}` : ''}
              orphaned={false}
              onOpen={() => (openDetailId = answer.anchorId)}
              onRemove={() => removeAnswer(answer.anchorId)}
            />
          {/each}

          {#each comments as comment, index (comment.id)}
            <BucketItem
              index={answers.length + index + 1}
              kind="comment"
              heading={comment.range.quote}
              body={comment.comment}
              at={comment.at}
              orphaned={orphanedIds.includes(comment.id)}
              onOpen={() => (openDetailId = comment.id)}
              onRemove={() => removeComment(comment.id)}
            />
          {/each}
        </ol>
      {/if}

      <footer data-part="bucket-actions">
        <button data-part="bucket-copy" type="button" onclick={() => copy(false)}>{copyLabel}</button>
        <button data-part="bucket-copy-clear" type="button" onclick={() => copy(true)}>
          Copy &amp; clear
        </button>
        <button data-part="bucket-clear" type="button" onclick={() => clearBucket(store)}>
          Clear
        </button>
      </footer>
    </section>
  {/if}
</div>

{#if pendingSelection}
  <div
    data-part="bucket-popover"
    data-doc-ui
    data-scope={pendingSelection.scope}
    style="--doc-popover-top: {pendingSelection.rect.bottom + window.scrollY}px;
           --doc-popover-left: {pendingSelection.rect.left + window.scrollX}px"
  >
    <p data-part="bucket-popover-target">
      Commenting on
      <span data-part="bucket-popover-quote">{pendingSelection.range.quote}</span>
    </p>

    <textarea
      data-part="bucket-draft"
      rows="4"
      placeholder="What should change here?"
      aria-label="Your comment"
      bind:this={composer}
      bind:value={draftComment}
      onkeydown={onComposerKeydown}
    ></textarea>

    <div data-part="bucket-popover-actions">
      <button data-part="bucket-save" type="button" onclick={saveComment}>Add comment</button>
      <button data-part="bucket-cancel" type="button" onclick={cancelComment}>Cancel</button>
      <span data-part="bucket-popover-hint">⌘↵ to save</span>
    </div>
  </div>
{/if}

{#if detail}
  {@const view = detail}
  <BucketDetail
    {view}
    onClose={() => (openDetailId = null)}
    onReveal={() => reveal(view)}
    onRemove={() => removeFromDetail(view)}
  />
{/if}

<!--
  No <style> block, deliberately.

  why (§10.1): panel styles live in `styles/components/bucket.css` inside
  `@layer doc.components`, where the `--doc-*` tokens reach them and where an
  author's unlayered CSS still beats them. In *custom element* mode Svelte would
  inline component styles as a JavaScript string instead of emitting CSS at all;
  mounting as a normal component and keeping styles in the sheet avoids that
  entirely.
-->
