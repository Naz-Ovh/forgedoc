<script lang="ts">
  /**
   * One question, rendered whole inside the drawer: the wording, every option
   * with its description, the Other field, the note, and a way back to the
   * place in the document it came from.
   *
   * Nothing here holds the answer. Selections are read from the store, which
   * `doc-choice` writes, and every control writes back through the element in
   * the document — so this card and the question it mirrors cannot disagree.
   */

  import { tick, untrack } from 'svelte';
  import {
    type AnswerMap,
    clearAnswer,
    isAnswered,
    isSelected,
    type QuestionView,
    selectOption,
    setNote,
    setOtherText,
    setRating,
  } from './model.js';

  interface Props {
    view: QuestionView;
    docPage: HTMLElement;
    /*
     * why `answers` rather than `state`: Svelte reads `$name` as a store
     * subscription whenever `name` is a declared variable, so a prop called
     * `state` turns every `$state(...)` rune in this file into `$state` the
     * store — which fails at runtime with "not a store with a subscribe
     * method". The rune wins the name; the prop takes another.
     */
    answers: AnswerMap;
    onGoTo: () => void;
  }

  const { view, docPage, answers, onGoTo }: Props = $props();

  /*
   * The two free-text fields are local drafts, seeded once, rather than bound to
   * the store.
   *
   * why: `doc-choice` trims before it persists, so a round trip through the
   * store turns "hello " back into "hello" — and a controlled textarea then
   * rewrites its own value mid-word and drops the reader's caret to the end. The
   * draft is what the reader typed; the element is told about it on every
   * keystroke, exactly as if they had typed it there.
   */
  let otherDraft = $state(untrack(() => answers[view.id]?.otherText ?? ''));
  let noteDraft = $state(untrack(() => answers[view.id]?.note ?? ''));

  /*
   * The note stays behind a toggle, exactly as it does in the document (§8.4).
   *
   * why it is not simply always there: the note is a comment on an answer the
   * reader may not have given yet, and an open field reads as something being
   * asked for. Nine of them down a panel turn a list of decisions into a form.
   * It opens itself only when it already holds text, so a note written earlier
   * is never hidden from the person who wrote it.
   */
  let noteOpen = $state(untrack(() => Boolean(answers[view.id]?.note)));
  let noteField = $state<HTMLTextAreaElement | null>(null);

  const answered = $derived(isAnswered(answers, view.id));
  const score = $derived(Number(answers[view.id]?.keys[0] ?? 0));
  const otherChosen = $derived(
    view.options.some((option) => option.other && isSelected(answers, view.id, option.value)),
  );

  const modeLabel = $derived(
    view.kind === 'rating'
      ? 'RATING'
      : view.mode === 'multi'
        ? 'MULTIPLE CHOICE'
        : 'SINGLE CHOICE',
  );

  /*
   * A group name of this card's own. The document's radios are named
   * `<id>-answer`, and a radio group is scoped to the whole document — so
   * reusing that name would put these inputs in the *same* group as the ones in
   * the page. Checking one here would silently uncheck the real one without
   * firing `change` on it, and the answer would never be persisted.
   */
  const groupName = $derived(`qd-${view.id}`);

  function toggle(value: string, checked: boolean): void {
    selectOption(docPage, view.id, value, checked);
  }

  function reset(): void {
    clearAnswer(docPage, view.id);
    otherDraft = '';
    noteDraft = '';
    noteOpen = false;
  }

  async function toggleNote(): Promise<void> {
    noteOpen = !noteOpen;
    if (!noteOpen) return;

    // The reader pressed a button asking for a field; land the caret in it.
    await tick();
    noteField?.focus();
  }
</script>

<article data-part="question-card" data-answered={answered ? '' : undefined} data-kind={view.kind}>
  <div data-part="question-card-meta">
    <span data-part="question-card-number">{view.label}</span>
    <span data-part="question-card-mode">{modeLabel}</span>
    {#if view.at}
      <span data-part="question-card-at">{view.at}</span>
    {/if}
    <!--
      Clear sits in the meta row rather than on a row of its own at the foot of
      the card. why: it applies to exactly one question, it is only ever shown
      once that question has an answer, and a row spent on one small button
      pushed the next question further down a panel whose whole job is to get
      several of them on screen at once.
    -->
    {#if answered}
      <button
        data-part="question-card-clear"
        type="button"
        title="Unanswer this question"
        onclick={reset}
      >
        Clear answer
      </button>
    {/if}

    <button
      data-part="question-card-goto"
      type="button"
      title="Close the panel and scroll to this question"
      onclick={onGoTo}
    >
      Go to it
    </button>
  </div>

  <h3 data-part="question-card-title">{view.question}</h3>

  {#if view.kind === 'rating'}
    <div data-part="question-card-scale" role="group" aria-label={view.question}>
      {#each view.scale as value (value)}
        <button
          data-part="question-card-score"
          type="button"
          aria-pressed={score === value}
          onclick={() => setRating(docPage, view.id, value)}
        >
          {value}
        </button>
      {/each}
    </div>
  {:else}
    <div data-part="question-card-options">
      {#each view.options as option (option.value)}
        {@const chosen = isSelected(answers, view.id, option.value)}
        <label data-part="question-card-option" data-selected={chosen ? '' : undefined}>
          <input
            type={view.mode === 'multi' ? 'checkbox' : 'radio'}
            name={groupName}
            value={option.value}
            checked={chosen}
            onchange={(event) => toggle(option.value, event.currentTarget.checked)}
          />
          <span data-part="question-card-option-key" aria-hidden="true">{option.key}</span>
          <span data-part="question-card-option-label">
            {option.label}
            {#if option.recommended}
              <span data-part="question-card-recommended">Recommended</span>
            {/if}
          </span>
          {#if option.description}
            <span data-part="question-card-option-desc">{option.description}</span>
          {/if}
        </label>
      {/each}
    </div>

    {#if otherChosen}
      <textarea
        data-part="question-card-other-text"
        rows="3"
        placeholder="Describe the answer you would rather give…"
        aria-label="Your own answer"
        value={otherDraft}
        oninput={(event) => {
          otherDraft = event.currentTarget.value;
          setOtherText(docPage, view.id, otherDraft);
        }}
      ></textarea>
    {/if}
  {/if}

  <button
    data-part="question-card-note-toggle"
    type="button"
    aria-expanded={noteOpen}
    onclick={toggleNote}
  >
    {noteOpen ? '− Note' : '＋ Add a note'}
  </button>

  {#if noteOpen}
    <textarea
      bind:this={noteField}
      data-part="question-card-note"
      rows="2"
      placeholder="Anything to add about this answer? This is a comment, not a second answer."
      aria-label="Note on this answer"
      value={noteDraft}
      oninput={(event) => {
        noteDraft = event.currentTarget.value;
        setNote(docPage, view.id, noteDraft);
      }}
    ></textarea>
  {/if}
</article>
