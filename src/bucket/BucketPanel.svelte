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
  /**
   * Id of the comment the composer is editing, or null when writing a new one.
   *
   * why a block comment reopens instead of stacking a second one: the button on
   * a card is the only handle that comment has. Pressing it again is a reader
   * going back to what they wrote — and a composer that opened blank told them
   * nothing, then quietly filed a duplicate against the same card. The button
   * stays visible on a commented card precisely so it can be used this way.
   */
  let editingId = $state<string | null>(null);
  /** Transient confirmation, so the keyboard shortcut is not a silent change. */
  let flashMessage = $state('');
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const hasHighlightApi = highlightApi() !== null;

  /*
   * ⌘ on Apple keyboards, Ctrl everywhere else.
   *
   * why sniff at all: the label is muscle memory, and `Ctrl+K` shown to someone
   * whose keyboard has no Ctrl in that position is worse than no hint. The
   * handler accepts either modifier regardless of what this says.
   */
  const APPLE = /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
  const shortcutLabel = APPLE ? '\u2318K' : 'Ctrl+K';

  /*
   * `$store` — the store contract in §9.2 exists precisely so this works with
   * zero glue. `subscribe` calls the subscriber immediately and returns its own
   * unsubscribe function, which is exactly what Svelte requires, so there is no
   * adapter, no wrapper store and no manual lifecycle here.
   */
  const docState = $derived<DocState>($store);

  const selectionPopup = $derived(docState.selectionPopup);

  /*
   * The selection watcher exists only while the preference is on.
   *
   * why detach the listeners rather than ignore events inside the callback:
   * `watchSelection` binds `pointerup` and `keyup` on `document`, and a reader
   * who turned the composer off did so to stop the document reacting to their
   * selections at all. Reading `selectionPopup` here is what re-runs this
   * effect on toggle; Svelte calls the returned teardown before re-running.
   */
  $effect(() => {
    if (!selectionPopup) return;
    return watchSelection(docPage, (event) => (pendingSelection = event));
  });

  $effect(() => () => clearTimeout(flashTimer));

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

      const existing = docState.feedback.find(
        (item) => item.scope === 'block' && item.range.anchorId === block.anchorId,
      );

      draftComment = existing?.comment ?? '';
      editingId = existing?.id ?? null;
      pendingSelection = {
        range: existing?.range ?? {
          anchorId: block.anchorId,
          start: 0,
          end: 0,
          quote: block.label,
        },
        rect: block.rect,
        at: existing?.at || locationLabel(element ?? docPage),
        scope: 'block',
      };
    };

    docPage.addEventListener(BLOCK_FEEDBACK_EVENT, handler);
    return () => docPage.removeEventListener(BLOCK_FEEDBACK_EVENT, handler);
  });

  // Repaint whenever the feedback list, the open detail or the draft changes.
  $effect(() => {
    paintHighlights(docPage, docState.feedback, {
      // While the composer is editing one, that is the item the reader is
      // looking at — the card should carry the active mark, not the resting one.
      activeId: openDetailId ?? editingId,
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

    if (editingId !== null) {
      // Rewritten in place, keeping `createdAt` and the anchor: this is the
      // same objection, said better, not a new one.
      store.set(
        'feedback',
        docState.feedback.map((item) =>
          item.id === editingId ? { ...item, comment: text } : item,
        ),
      );
      cancelComment();
      return;
    }

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
    editingId = null;
    pendingSelection = null;
    window.getSelection()?.removeAllRanges();
  }

  /** Discard the comment the composer is editing, from the composer itself. */
  function deleteEditing(): void {
    if (editingId === null) return;
    removeComment(editingId);
    cancelComment();
  }

  function flash(message: string): void {
    flashMessage = message;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flashMessage = ''), 1800);
  }

  /**
   * Turn the selection composer on or off, and say so.
   *
   * why an unsaved draft survives being switched off: the shortcut is a single
   * keystroke, and `Ctrl+K` is close enough to the keys used while typing that
   * it will be hit by accident mid-comment. Throwing away words the reader had
   * already written would be the worst possible response to a mistyped
   * shortcut, so a composer holding text stays up to be saved or cancelled
   * deliberately — only an empty one is dismissed. Either way no *new* popover
   * opens after this point.
   */
  function setSelectionPopup(on: boolean): void {
    store.set('selectionPopup', on);
    if (!on && draftComment.trim() === '') cancelComment();

    /*
     * The confirmation is only for the shortcut used against a closed panel.
     * With the panel open the switch is right there changing state, and the
     * toast would land underneath the panel anyway — both are anchored to the
     * same corner as the trigger.
     */
    if (!panelOpen) flash(on ? 'Selection comments on' : 'Selection comments off');
  }

  /**
   * ⌘/Ctrl + K toggles the composer from anywhere in the document.
   *
   * why this one is safe to claim: `⌘/Ctrl+K` is the de-facto page-level
   * command shortcut on the web and browsers let a page take it, unlike the
   * genuinely reserved `Ctrl+T`/`Ctrl+N`/`Ctrl+W`. Chords carrying Alt or Shift
   * are left alone so this does not shadow a browser or OS binding that merely
   * starts the same way.
   */
  function onWindowKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'k') return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;

    event.preventDefault();
    setSelectionPopup(!selectionPopup);
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
<svelte:window onkeydown={onWindowKeydown} />

<div
  data-part="bucket-root"
  data-doc-ui
  data-open={panelOpen ? '' : undefined}
  data-selection={selectionPopup ? 'on' : 'off'}
>
  <!--
    `role="status"` rather than an alert: this confirms something the reader
    just asked for, so it should reach a screen reader without stealing focus
    or interrupting what is being read.
  -->
  {#if flashMessage}
    <p data-part="bucket-flash" role="status">{flashMessage}</p>
  {/if}

  <!--
    The trigger carries the composer's state, not just the count.

    why: the switch that turns selection commenting off lives inside the panel,
    so once the panel is closed the only evidence of the change was that
    selecting text stopped doing anything — which reads as a broken document
    rather than a setting. The slashed mark says "off" from across the page,
    and the tooltip says how to undo it without opening anything.
  -->
  <button
    data-part="bucket-trigger"
    type="button"
    aria-expanded={panelOpen}
    title={selectionPopup
      ? undefined
      : `Selection comments are off — ${shortcutLabel} turns them back on`}
    onclick={() => (panelOpen = !panelOpen)}
  >
    {#if !selectionPopup}
      <span data-part="bucket-trigger-muted">
        <span data-doc-visually-hidden>Selection comments off.</span>
      </span>
    {/if}
    <span data-part="bucket-trigger-label">Feedback</span>
    <span data-part="bucket-count">{count}</span>
  </button>

  {#if panelOpen}
    <section data-part="bucket-panel" aria-label="Feedback review">
      <!--
        The switch sits in the title row rather than on a settings band of its
        own.

        why the visible label went: it is the panel's only preference, and a
        full row spent spelling out "Comment on text selection" restated what
        the switch beside it already shows — while pushing the list of the
        reader's own feedback further down the panel. The name survives as the
        accessible name and as the tooltip, so nothing is lost to a screen
        reader or to a reader who hovers; the keycap keeps the other half of
        the old row's job, which was telling people the shortcut exists.
      -->
      <header data-part="bucket-header">
        <span data-part="bucket-title">Your feedback</span>

        <button
          data-part="bucket-selection-toggle"
          type="button"
          aria-pressed={selectionPopup}
          aria-label="Comment on text selection"
          title="Comment on text selection ({shortcutLabel})"
          onclick={() => setSelectionPopup(!selectionPopup)}
        >
          <span data-part="bucket-switch" aria-hidden="true"></span>
        </button>
        <kbd data-part="bucket-shortcut">{shortcutLabel}</kbd>

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
        <!--
          The instructions have to match the switch above them. Telling a reader
          to select text when selection has been turned off sends them off to
          try the one route that has been closed.
        -->
        <p data-part="bucket-empty">
          {#if selectionPopup}
            Answer a question, select any text in the document, or use the Comment button on a
            diagram or code block.
          {:else}
            Answer a question, or use the Comment button on a diagram or code block. Commenting by
            selecting text is off — press {shortcutLabel} to turn it back on.
          {/if}
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
      {editingId === null ? 'Commenting on' : 'Your comment on'}
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
      <button data-part="bucket-save" type="button" onclick={saveComment}>
        {editingId === null ? 'Add comment' : 'Save changes'}
      </button>
      <button data-part="bucket-cancel" type="button" onclick={cancelComment}>Cancel</button>

      <!--
        why delete belongs here and not only in the panel: this composer is
        where the reader is looking at the comment. Sending them to open the
        feedback panel and find the same item again to throw it away is a trip
        for something they have already decided.
      -->
      {#if editingId !== null}
        <button data-part="bucket-delete" type="button" onclick={deleteEditing}>Delete</button>
      {/if}

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
