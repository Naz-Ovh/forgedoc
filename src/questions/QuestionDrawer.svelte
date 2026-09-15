<script lang="ts">
  /**
   * The question drawer — every question in the document, in one panel.
   *
   * why this is Svelte (AGENTS.md, §2.5): the rule is "runtime creates the DOM
   * → Svelte fine; runtime enhances author DOM → vanilla". Nothing here is
   * author content. The drawer is built from scratch each time it opens, from a
   * scrape of the document, and it is genuinely stateful reactive UI — a filter,
   * a live progress count, and a set of controls that write through to elements
   * elsewhere in the page.
   *
   * why it costs a document nothing (§2.4): the agent writes one `doc-choice`
   * per question and no more. The panel is derived at the moment the reader
   * opens it, so a document gains this feature by being rebuilt with a newer
   * runtime rather than by carrying a second copy of every question.
   *
   * The problem it solves is the one a long plan always has: the questions are
   * the only part of the document the reader is *required* to act on, and they
   * are scattered through sections written to be read in order. There was no way
   * to see what was still open without scrolling the whole thing.
   */

  import type { DocState, DocStore } from '../core/types.js';
  import { ICON_PATHS } from '../core/icons.js';
  import QuestionCard from './QuestionCard.svelte';
  import {
    collectQuestions,
    isAnswered,
    QUESTIONS_OPEN_EVENT,
    type QuestionView,
    revealQuestion,
  } from './model.js';

  interface Props {
    docPage: HTMLElement;
    store: DocStore;
  }

  const { docPage, store }: Props = $props();

  const docState = $derived<DocState>($store);

  let dialog = $state<HTMLDialogElement | null>(null);
  let content = $state<HTMLElement | null>(null);
  let closeButton = $state<HTMLButtonElement | null>(null);
  let open = $state(false);
  /**
   * The scrape. Captured when the panel opens rather than kept live.
   *
   * why not re-read on every store change: the question *text* cannot change
   * while a reader is looking at it — the document is static — and re-scraping
   * on every keystroke would rebuild every card and take the caret with it. The
   * answers are read from the store, which is reactive; the questions are read
   * once, which is all they need.
   */
  let questions = $state<QuestionView[]>([]);
  let unansweredOnly = $state(false);

  const answers = $derived(docState.answers);
  const answered = $derived(questions.filter((question) => isAnswered(answers, question.id)));
  const shown = $derived(
    unansweredOnly ? questions.filter((question) => !isAnswered(answers, question.id)) : questions,
  );

  /*
   * The contents panel's trigger is the only way in, and it is a plain custom
   * event so `doc-toc` never has to know this component exists.
   */
  $effect(() => {
    const onOpen = (): void => {
      questions = collectQuestions(docPage);
      open = true;
    };

    docPage.addEventListener(QUESTIONS_OPEN_EVENT, onOpen);
    return () => docPage.removeEventListener(QUESTIONS_OPEN_EVENT, onOpen);
  });

  /*
   * `showModal` rather than `show`, for three things that would otherwise all
   * need writing by hand: Escape closes it, focus is trapped inside it, and the
   * document behind it goes inert.
   *
   * That last one is not cosmetic. Every control in this panel writes through to
   * a real element in the document, and `doc-choice` re-focuses its own Other
   * textarea whenever the answer changes. With the document live, typing a note
   * in the drawer would pull the caret out of the drawer on the first keystroke.
   * Inert elements cannot take focus, so that call becomes the no-op it should
   * always have been.
   */
  $effect(() => {
    const element = dialog;
    if (!element) return;

    if (!open) {
      if (element.open) element.close();
      return;
    }
    if (element.open) return;

    element.showModal();

    /*
     * Start at the top, looking at the close button.
     *
     * why both are set by hand: the dialog focusing steps pick the first
     * focusable descendant, and this panel's first few are a question's own
     * controls — so the browser focused a note field halfway down the list and
     * scrolled the panel to it, which opened the drawer in the middle of a
     * question the reader had not asked for. Naming the control that should
     * have focus is the whole fix, and resetting the scroll makes a reopen
     * start where the first one did.
     */
    if (content) content.scrollTop = 0;
    closeButton?.focus();
  });

  function goTo(id: string): void {
    open = false;
    revealQuestion(docPage, id);
  }

  /** Dismiss when the click landed on the backdrop rather than on the panel. */
  function closeFromBackdrop(event: MouseEvent): void {
    if (event.target !== dialog || !dialog) return;

    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) open = false;
  }
</script>

<!--
  `data-doc-ui` marks this as the runtime's own interface: the bucket's selection
  watcher ignores events from inside it, so selecting a word in a question here
  does not pop the comment composer over the panel the reader is working in.
-->
<dialog
  bind:this={dialog}
  data-part="question-drawer"
  data-doc-ui
  aria-label="Questions in this document"
  onclose={() => (open = false)}
  onclick={closeFromBackdrop}
>
  <header data-part="question-drawer-header">
    <span data-part="question-drawer-eyebrow">Questions</span>

    <p data-part="question-drawer-progress">
      {answered.length} of {questions.length} answered
    </p>

    <button
      data-part="question-drawer-filter"
      type="button"
      aria-pressed={unansweredOnly}
      onclick={() => (unansweredOnly = !unansweredOnly)}
    >
      Unanswered only
    </button>

    <button
      bind:this={closeButton}
      data-part="question-drawer-close"
      type="button"
      aria-label="Close the question list"
      onclick={() => (open = false)}
    >
      <svg
        data-part="close-icon"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d={ICON_PATHS.close} />
      </svg>
    </button>
  </header>

  <div bind:this={content} data-part="question-drawer-content">
    {#if shown.length === 0}
      <p data-part="question-drawer-empty">
        {#if questions.length === 0}
          This document asks no questions.
        {:else}
          Every question is answered. Open the feedback panel to copy them back.
        {/if}
      </p>
    {:else}
      {#each shown as question (question.id)}
        <QuestionCard
          view={question}
          {docPage}
          {answers}
          onGoTo={() => goTo(question.id)}
        />
      {/each}
    {/if}
  </div>
</dialog>

<!--
  No <style> block, deliberately — same reason as the bucket (§10.1). The panel
  is painted from `styles/*/components/questions.scss` inside `@layer doc.theme`,
  where the `--doc-*` tokens reach it and an author's unlayered CSS still beats
  it. In custom element mode Svelte would inline these styles as a JavaScript
  string instead of emitting CSS at all.
-->
