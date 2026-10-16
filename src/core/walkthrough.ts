/**
 * The walkthrough's model: what the author wrote, read once, and the stage
 * state at any scene.
 *
 * why a separate module from the element: the element animates, and animation
 * is hard to reason about when it also owns the bookkeeping. Scenes accumulate
 * — a row added in scene two is still there in scene four — so jumping straight
 * to a dot has to rebuild the state from the start rather than replay motion.
 * Keeping that a pure function of (actors, scenes, index) makes the jump, the
 * step back and the replay the same code path, and lets it be tested without a
 * single animation frame.
 */

import type { ActorKind } from './icons.js';

/** A participant on the stage, as authored. */
export interface ActorSpec {
  readonly name: string;
  readonly label: string;
  readonly kind: ActorKind | null;
  readonly tone: string;
  readonly absent: boolean;
  /** The actor's own short text, outside its starting rows. */
  readonly note: string;
  readonly rows: readonly string[];
}

/** A token travelling between two actors. */
export interface MoveStep {
  readonly type: 'move';
  readonly from: string;
  readonly to: string;
  readonly token: string;
  readonly result: 'accept' | 'reject' | null;
}

/** A change to one actor. Several of `add`/`remove`/`set`/`drop` may combine. */
export interface ChangeStep {
  readonly type: 'change';
  readonly actor: string;
  readonly add: string | null;
  readonly remove: string | null;
  readonly set: string | null;
  readonly tone: string;
  readonly drop: boolean;
}

export type SceneStep = MoveStep | ChangeStep;

/** One scene, as authored. `element` is the author's `doc-scene`. */
export interface SceneSpec {
  readonly element: HTMLElement;
  readonly title: string;
  /** Actors to highlight; every other actor dims. Empty means highlight nothing. */
  readonly focus: readonly string[];
  readonly steps: readonly SceneStep[];
}

/** A row on an actor's card, with enough history to animate its arrival or exit. */
export interface RowState {
  readonly text: string;
  readonly tone: string;
  /** Scene that added it, or -1 for a starting row. */
  readonly since: number;
  /** Scene that removed it, if any. It is shown struck through in that scene only. */
  readonly removedAt: number | null;
}

/** Everything a card shows at a given scene. */
export interface ActorState {
  present: boolean;
  dropped: boolean;
  rows: RowState[];
  status: { readonly text: string; readonly tone: string; readonly since: number } | null;
}

export type StageState = Map<string, ActorState>;

const ACTOR_KINDS: readonly string[] = ['person', 'app', 'service', 'table', 'store'];

/** Read every `doc-actor` that belongs to `walkthrough`. */
export function readActors(walkthrough: Element): ActorSpec[] {
  return Array.from(walkthrough.querySelectorAll(':scope > doc-actor')).map((actor) => {
    const name = attr(actor, 'name');
    const kind = attr(actor, 'kind');
    return {
      name,
      label: attr(actor, 'label') || name,
      kind: ACTOR_KINDS.includes(kind) ? (kind as ActorKind) : null,
      tone: attr(actor, 'tone') || 'neutral',
      absent: actor.hasAttribute('absent'),
      note: noteOf(actor),
      rows: Array.from(actor.querySelectorAll(':scope > ul > li, :scope > ol > li')).map((item) =>
        squash(item.textContent),
      ),
    };
  });
}

/** Read every `doc-scene` that belongs to `walkthrough`, with its steps in order. */
export function readScenes(walkthrough: Element): SceneSpec[] {
  return Array.from(walkthrough.querySelectorAll<HTMLElement>(':scope > doc-scene')).map(
    (scene) => {
      const steps = Array.from(scene.querySelectorAll(':scope > doc-move, :scope > doc-change'))
        .map(readStep)
        .filter((step): step is SceneStep => step !== null);
      const authoredFocus = attr(scene, 'focus').split(/\s+/).filter(Boolean);
      return {
        element: scene,
        title: attr(scene, 'title'),
        focus: authoredFocus.length > 0 ? authoredFocus : involvedActors(steps),
        steps,
      };
    },
  );
}

function readStep(element: Element): SceneStep | null {
  if (element.tagName.toLowerCase() === 'doc-move') {
    const result = attr(element, 'result');
    return {
      type: 'move',
      from: attr(element, 'from'),
      to: attr(element, 'to'),
      token: attr(element, 'token') || '•',
      result: result === 'accept' || result === 'reject' ? result : null,
    };
  }
  return {
    type: 'change',
    actor: attr(element, 'actor'),
    add: element.getAttribute('add'),
    remove: element.getAttribute('remove'),
    set: element.getAttribute('set'),
    tone: attr(element, 'tone') || 'neutral',
    drop: element.hasAttribute('drop'),
  };
}

/** Every actor a list of steps touches, in first-touch order. */
export function involvedActors(steps: readonly SceneStep[]): string[] {
  const names = new Set<string>();
  for (const step of steps) {
    if (step.type === 'move') {
      names.add(step.from);
      names.add(step.to);
    } else {
      names.add(step.actor);
    }
  }
  return [...names];
}

/** The stage before any scene has played. */
export function initialState(actors: readonly ActorSpec[]): StageState {
  const state: StageState = new Map();
  for (const actor of actors) {
    state.set(actor.name, {
      present: !actor.absent,
      dropped: false,
      rows: actor.rows.map((text) => ({ text, tone: 'neutral', since: -1, removedAt: null })),
      status: null,
    });
  }
  return state;
}

/**
 * Apply one change, made during scene `sceneIndex`, to `state` in place.
 *
 * Touching an absent actor brings it on stage — that is how a table "gets
 * created" in a migration walkthrough without a separate verb for it.
 */
export function applyChange(state: StageState, change: ChangeStep, sceneIndex: number): void {
  const actor = state.get(change.actor);
  if (!actor) return;

  actor.present = true;
  if (change.drop) actor.dropped = true;
  if (change.set !== null) {
    actor.status = { text: change.set, tone: change.tone, since: sceneIndex };
  }
  if (change.remove !== null) markRemoved(actor, change.remove, sceneIndex);
  if (change.add !== null) {
    actor.rows.push({ text: change.add, tone: change.tone, since: sceneIndex, removedAt: null });
  }
}

function markRemoved(actor: ActorState, text: string, sceneIndex: number): void {
  const wanted = squash(text);
  const index = actor.rows.findIndex((row) => row.removedAt === null && row.text === wanted);
  const row = actor.rows[index];
  if (!row) return;
  actor.rows[index] = { ...row, removedAt: sceneIndex };
}

/**
 * The stage as it stands *after* scene `index`, or before every scene for -1.
 *
 * Rows removed in an earlier scene are gone; one removed in this very scene is
 * kept, marked, so the reader sees it struck out before it disappears.
 */
export function stateAt(
  actors: readonly ActorSpec[],
  scenes: readonly SceneSpec[],
  index: number,
): StageState {
  const state = initialState(actors);
  for (let sceneIndex = 0; sceneIndex <= index; sceneIndex++) {
    for (const step of scenes[sceneIndex]?.steps ?? []) {
      if (step.type === 'change') applyChange(state, step, sceneIndex);
    }
  }
  for (const actor of state.values()) {
    actor.rows = actor.rows.filter((row) => row.removedAt === null || row.removedAt === index);
  }
  return state;
}

/** The actor's own words: its text with any starting-row list left out. */
function noteOf(actor: Element): string {
  let text = '';
  for (const node of Array.from(actor.childNodes)) {
    if (node instanceof Element && (node.tagName === 'UL' || node.tagName === 'OL')) continue;
    text += ` ${node.textContent ?? ''}`;
  }
  return squash(text);
}

function attr(element: Element, name: string): string {
  return element.getAttribute(name)?.trim() ?? '';
}

function squash(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}
