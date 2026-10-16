/**
 * `<doc-walkthrough title="…">` — an animated scene player.
 *
 * The author writes actors and scenes; the runtime builds a stage of cards,
 * flies each scene's tokens between them, applies each scene's changes, and
 * wires Prev / Play / Next, one dot per scene and the arrow keys.
 *
 * ```html
 * <doc-walkthrough title="One login, one surface">
 *   <doc-actor name="vendor" label="Vendor panel" kind="app" tone="cyan"></doc-actor>
 *   <doc-actor name="admin" label="Admin route" kind="service"></doc-actor>
 *   <doc-scene title="Wrong door">
 *     <doc-move from="vendor" to="admin" token="ub_vendor_session" result="reject"></doc-move>
 *     <p>An admin route ignores the vendor cookie, so the answer is 401.</p>
 *   </doc-scene>
 * </doc-walkthrough>
 * ```
 *
 * why the stage is runtime-built chrome rather than the author's `doc-actor`
 * elements laid out in place (§2.2): a card needs an icon, rows that come and
 * go per scene and a result badge, and the actors must sit in a grid the tokens
 * can fly across. Restyling the author's elements into that grid would mean
 * either moving them or turning the host into a grid that also holds the
 * captions — which constraint 3 forbids. So the actors stay where they were
 * written, as data, and the cards are drawn beside them. The captions are the
 * author's own `doc-scene` elements, shown one at a time, so text selection and
 * comments work on them exactly as on any paragraph.
 *
 * Motion is decoration on top of a state machine: every scene has a complete
 * static rendering (`stateAt`), and animation only plays the last step into it.
 * With `prefers-reduced-motion: reduce` nothing travels; the scene simply
 * appears in its final state.
 */

import { type Arc, arcBetween, arcPath, arrowheadPath, type Box, pointOnArc } from '../core/arc.js';
import { DocElement } from '../core/base.js';
import {
  type ActorKind,
  actorIcon,
  arrowLeftIcon,
  arrowRightIcon,
  playIcon,
  resultIcon,
} from '../core/icons.js';
import { createPart } from '../core/parts.js';
import {
  type ActorSpec,
  type ActorState,
  applyChange,
  type ChangeStep,
  type MoveStep,
  readActors,
  readScenes,
  type SceneSpec,
  type StageState,
  stateAt,
} from '../core/walkthrough.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** How long a token takes to cross the stage, and the pause after a change. */
const TRAVEL_MS = 950;
const CHANGE_MS = 520;

/** Reading time on a scene while playing: a base plus a little per caption word. */
const DWELL_BASE_MS = 1700;
const DWELL_PER_WORD_MS = 55;
const DWELL_MAX_MS = 6500;

export class DocWalkthrough extends DocElement {
  #actors: ActorSpec[] = [];
  #scenes: SceneSpec[] = [];
  #index = 0;
  /** Bumped on every render; an animation that sees a newer value stops. */
  #run = 0;
  /** Bumped on every Play press, so a stale play loop cannot resume. */
  #playGeneration = 0;
  #playing = false;
  #introduced = false;

  readonly #cards = new Map<string, HTMLElement>();
  #stage: HTMLElement | null = null;
  #arrows: SVGSVGElement | null = null;
  #log: HTMLElement | null = null;
  #counter: HTMLElement | null = null;
  #playButton: HTMLButtonElement | null = null;
  #prevButton: HTMLButtonElement | null = null;
  #nextButton: HTMLButtonElement | null = null;
  #dots: HTMLButtonElement[] = [];
  #observers: { disconnect(): void }[] = [];

  protected enhance(): void {
    this.#actors = readActors(this);
    this.#scenes = readScenes(this);
    this.internals.role = 'region';
    this.internals.ariaLabel = this.attr('title', 'Walkthrough');
    if (this.#actors.length === 0 || this.#scenes.length === 0) return;

    this.prepend(this.#buildHeader(), this.#buildStage());
    this.append(this.#buildLog(), this.#buildControls());
    this.#wireKeys();

    // The first scene is drawn in the state it *starts* from, and plays its
    // motion the first time the reader scrolls it into view.
    void this.#show(0, false, { before: true });
    this.#watchViewport();
  }

  protected override teardown(): void {
    this.#playing = false;
    this.#run++;
    for (const observer of this.#observers) observer.disconnect();
    this.#observers = [];
  }

  // ── Building the chrome ─────────────────────────────────────────────────

  #buildHeader(): HTMLElement {
    const header = createPart('header');
    const title = this.attr('title');
    if (title) header.append(createPart('title', 'span', { text: title }));
    this.#counter = createPart('counter', 'span');
    header.append(this.#counter);
    return header;
  }

  #buildStage(): HTMLElement {
    const stage = createPart('stage');
    stage.tabIndex = 0;
    stage.setAttribute('role', 'group');
    stage.setAttribute(
      'aria-label',
      'Stage. Arrow keys step through the scenes, Space plays, click replays the scene.',
    );

    const arrows = document.createElementNS(SVG_NS, 'svg');
    arrows.dataset.part = 'arrows';
    arrows.dataset.docChrome = '';
    arrows.setAttribute('aria-hidden', 'true');
    stage.append(arrows);
    this.#arrows = arrows;

    for (const actor of this.#actors) {
      const card = buildCard(actor);
      this.#cards.set(actor.name, card);
      stage.append(card);
    }

    this.on(stage, 'click', () => this.#userGo(this.#index));
    this.#stage = stage;
    return stage;
  }

  #buildLog(): HTMLElement {
    const log = createPart('log', 'ol');
    log.setAttribute('aria-live', 'polite');
    this.#log = log;
    return log;
  }

  #buildControls(): HTMLElement {
    const controls = createPart('controls');

    const play = createPart('play-btn', 'button') as HTMLButtonElement;
    play.type = 'button';
    this.on(play, 'click', () => this.#togglePlay());
    this.#playButton = play;
    this.#renderPlayButton();

    const dots = createPart('dots');
    this.#dots = this.#scenes.map((scene, index) => {
      const dot = createPart('dot', 'button') as HTMLButtonElement;
      dot.type = 'button';
      dot.setAttribute('aria-label', `Scene ${index + 1}: ${scene.title}`);
      dot.title = scene.title;
      this.on(dot, 'click', () => this.#userGo(index));
      dots.append(dot);
      return dot;
    });

    this.#prevButton = stepButton('prev-btn', 'Previous scene', arrowLeftIcon('prev-icon'));
    this.#nextButton = stepButton('next-btn', 'Next scene', arrowRightIcon('next-icon'));
    this.on(this.#prevButton, 'click', () => this.#userGo(this.#index - 1));
    this.on(this.#nextButton, 'click', () => this.#userGo(this.#index + 1));

    controls.append(play, dots, this.#prevButton, this.#nextButton);
    return controls;
  }

  #wireKeys(): void {
    this.on(this, 'keydown', (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const last = this.#scenes.length - 1;
      const targets: Record<string, number> = {
        ArrowRight: this.#index + 1,
        ArrowLeft: this.#index - 1,
        Home: 0,
        End: last,
      };
      const target = targets[event.key];
      if (target !== undefined) {
        event.preventDefault();
        this.#userGo(target);
        return;
      }
      if (event.key === ' ' && event.target === this.#stage) {
        event.preventDefault();
        this.#togglePlay();
      }
    });
  }

  /**
   * Play the first scene's motion when the reader first sees it, and redraw
   * the arrows whenever the stage changes width — the grid may have rewrapped.
   */
  #watchViewport(): void {
    const stage = this.#stage;
    if (!stage) return;

    if (typeof IntersectionObserver === 'function') {
      const intro = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          intro.disconnect();
          if (this.#introduced) return;
          this.#introduced = true;
          void this.#show(this.#index, true);
        },
        { threshold: 0.5 },
      );
      intro.observe(stage);
      this.#observers.push(intro);
    } else {
      void this.#show(0, false);
    }

    if (typeof ResizeObserver === 'function') {
      let width = 0;
      const resize = new ResizeObserver(([entry]) => {
        const next = Math.round(entry?.contentRect.width ?? 0);
        if (width !== 0 && next !== width) void this.#show(this.#index, false);
        width = next;
      });
      resize.observe(stage);
      this.#observers.push(resize);
    }
  }

  // ── Navigation and play ─────────────────────────────────────────────────

  /** A reader's request for a scene: it stops autoplay and plays that scene. */
  #userGo(index: number): void {
    if (index < 0 || index >= this.#scenes.length) return;
    this.#introduced = true;
    this.#setPlaying(false);
    void this.#show(index, true);
  }

  #togglePlay(): void {
    if (this.#playing) {
      this.#setPlaying(false);
      return;
    }
    void this.#playFrom(this.#index >= this.#scenes.length - 1 ? 0 : this.#index);
  }

  /** Play every scene from `start` to the end, pausing on each to read it. */
  async #playFrom(start: number): Promise<void> {
    this.#introduced = true;
    this.#setPlaying(true);
    const generation = ++this.#playGeneration;
    const live = (): boolean => this.#playing && generation === this.#playGeneration;

    for (let index = start; index < this.#scenes.length; index++) {
      await this.#show(index, true);
      if (!live()) return;
      await wait(dwellFor(this.#scenes[index]));
      if (!live()) return;
    }
    this.#setPlaying(false);
  }

  #setPlaying(playing: boolean): void {
    this.#playing = playing;
    this.setState('playing', playing);
    this.#renderPlayButton();
  }

  #renderPlayButton(): void {
    const button = this.#playButton;
    if (!button) return;
    const label = this.#playing ? 'Pause' : 'Play';
    button.replaceChildren(playIcon(this.#playing), document.createTextNode(label));
    button.setAttribute('aria-pressed', String(this.#playing));
  }

  // ── Rendering a scene ───────────────────────────────────────────────────

  /**
   * Show scene `index`. With `animate` (and motion allowed) its moves fly and
   * its changes land one by one; otherwise it appears complete. `before` draws
   * the state the scene starts from, with none of its own steps — the frame
   * the intro animation begins on.
   */
  async #show(index: number, animate: boolean, options: { before?: boolean } = {}): Promise<void> {
    const run = ++this.#run;
    const scene = this.#scenes[index];
    if (!scene) return;
    this.#index = index;
    this.#renderNavigation();
    this.#clearScene();
    this.#applyFocus(scene);

    if (options.before) {
      this.#renderCards(stateBefore(this.#actors, this.#scenes, index), index);
      return;
    }

    if (!animate || prefersReducedMotion()) {
      this.#renderCards(stateAt(this.#actors, this.#scenes, index), index);
      for (const step of scene.steps) {
        if (step.type !== 'move') continue;
        this.#drawArrow(step);
        this.#landMove(step);
        this.#logStep(step);
      }
      return;
    }

    await this.#playSteps(scene, index, run);
  }

  async #playSteps(scene: SceneSpec, index: number, run: number): Promise<void> {
    const state = stateBefore(this.#actors, this.#scenes, index);
    this.#renderCards(state, index);

    for (const step of scene.steps) {
      if (run !== this.#run) return;
      if (step.type === 'move') {
        this.#logStep(step);
        await this.#animateMove(step, run);
        continue;
      }
      applyChange(state, step, index);
      this.#renderCard(step.actor, state.get(step.actor), index);
      await wait(CHANGE_MS);
    }
  }

  #renderNavigation(): void {
    const index = this.#index;
    const count = this.#scenes.length;
    this.#scenes.forEach((scene, position) => {
      scene.element.hidden = position !== index;
    });
    this.#dots.forEach((dot, position) => {
      dot.dataset.active = String(position === index);
      if (position === index) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
    if (this.#counter) this.#counter.textContent = `Scene ${index + 1} of ${count}`;
    if (this.#prevButton) this.#prevButton.disabled = index === 0;
    if (this.#nextButton) this.#nextButton.disabled = index === count - 1;
  }

  /** Remove everything the previous scene drew: arrows, tokens, results, log. */
  #clearScene(): void {
    this.#arrows?.replaceChildren();
    for (const token of this.#stage?.querySelectorAll('[data-part="token"]') ?? []) token.remove();
    for (const card of this.#cards.values()) delete card.dataset.result;
    this.#log?.replaceChildren();
  }

  #applyFocus(scene: SceneSpec): void {
    const focus = new Set(scene.focus);
    for (const [name, card] of this.#cards) {
      if (focus.size === 0) delete card.dataset.focus;
      else card.dataset.focus = focus.has(name) ? 'on' : 'off';
    }
  }

  #renderCards(state: StageState, index: number): void {
    for (const [name, actorState] of state) this.#renderCard(name, actorState, index);
  }

  #renderCard(name: string, actorState: ActorState | undefined, index: number): void {
    const card = this.#cards.get(name);
    if (!card || !actorState) return;

    card.dataset.presence = !actorState.present
      ? 'absent'
      : actorState.dropped
        ? 'dropped'
        : 'present';
    reconcileRows(card, actorState, index);

    const status = card.querySelector<HTMLElement>('[data-part="card-status"]');
    if (!status) return;
    status.hidden = actorState.status === null;
    status.textContent = actorState.status?.text ?? '';
    status.dataset.tone = actorState.status?.tone ?? 'neutral';
    status.toggleAttribute('data-fresh', actorState.status?.since === index);
  }

  /**
   * One transcript line per move. Changes are not logged: they stay visible on
   * the cards, where the reader is already looking. Moves vanish once played,
   * so the transcript is their lasting, readable (and screen-read) trace.
   */
  #logStep(step: MoveStep): void {
    const row = createPart('log-row', 'li');
    row.textContent = describeStep(step, this.#labelOf.bind(this));
    if (step.result) row.dataset.result = step.result;
    this.#log?.append(row);
  }

  #labelOf(name: string): string {
    return this.#actors.find((actor) => actor.name === name)?.label ?? name;
  }

  // ── Moves ───────────────────────────────────────────────────────────────

  /** The curve from one card to another, in stage coordinates. */
  #arcFor(step: MoveStep): Arc | null {
    const stage = this.#stage;
    const from = this.#cards.get(step.from);
    const to = this.#cards.get(step.to);
    if (!stage || !from || !to || from === to) return null;

    const origin = stage.getBoundingClientRect();
    return arcBetween(boxWithin(from, origin), boxWithin(to, origin), origin);
  }

  /** Draw a move's arrow and return it, or null when it cannot be drawn. */
  #drawArrow(step: MoveStep): SVGGElement | null {
    const arc = this.#arcFor(step);
    const arrows = this.#arrows;
    if (!arc || !arrows) return null;

    const group = document.createElementNS(SVG_NS, 'g');
    group.dataset.part = 'arrow';
    if (step.result) group.dataset.result = step.result;

    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('d', arcPath(arc));
    const head = document.createElementNS(SVG_NS, 'path');
    head.setAttribute('d', arrowheadPath(arc));
    head.dataset.part = 'arrow-head';
    group.append(line, head);
    arrows.append(group);
    return group;
  }

  /** Mark the move's outcome on its target card. */
  #landMove(step: MoveStep): void {
    const card = this.#cards.get(step.to);
    if (!card || !step.result) return;
    card.dataset.result = step.result;
    const badge = card.querySelector('[data-part="card-result"]');
    badge?.replaceChildren(resultIcon(step.result));
  }

  async #animateMove(step: MoveStep, run: number): Promise<void> {
    const arc = this.#arcFor(step);
    const arrow = this.#drawArrow(step);
    const stage = this.#stage;
    if (!arc || !arrow || !stage) return;

    revealArrow(arrow);
    const token = createPart('token', 'span', { text: step.token });
    if (step.result) token.dataset.result = step.result;
    stage.append(token);

    await finished(
      token.animate(travelFrames(arc, token), {
        duration: TRAVEL_MS,
        easing: 'cubic-bezier(0.45, 0, 0.25, 1)',
        fill: 'forwards',
      }),
    );
    if (run !== this.#run) return;

    this.#landMove(step);
    await finished(token.animate(arrivalFrames(arc, token, step.result), arrivalTiming(step)));
    token.remove();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** One card per actor; its rows and status are filled in per scene. */
function buildCard(actor: ActorSpec): HTMLElement {
  const card = createPart('card');
  card.dataset.actor = actor.name;
  card.dataset.tone = actor.tone;

  const head = createPart('card-label', 'span');
  head.append(...breakable(actor.label));
  if (actor.kind) card.append(actorIcon(actor.kind as ActorKind));
  card.append(head);
  if (actor.note) {
    const note = createPart('card-note', 'span');
    note.append(...breakable(actor.note));
    card.append(note);
  }
  card.append(createPart('card-rows', 'ul'));

  const status = createPart('card-status', 'span');
  status.hidden = true;
  const result = createPart('card-result', 'span');
  result.setAttribute('aria-hidden', 'true');
  card.append(status, result);
  return card;
}

/**
 * Text with a line-break opportunity after every `_`, `.`, `/` and `-`.
 *
 * why: actor labels are identifiers — `customer_accounts`, `authenticateAdmin`
 * — and a narrow card otherwise either overflows or breaks mid-letter
 * (`customer_ac|counts`). `<wbr>` breaks at the joint and costs nothing when
 * the line fits.
 */
function breakable(text: string): Node[] {
  const nodes: Node[] = [];
  for (const piece of text.split(/(?<=[_./-])/)) {
    if (nodes.length > 0) nodes.push(document.createElement('wbr'));
    nodes.push(document.createTextNode(piece));
  }
  return nodes;
}

/**
 * Bring a card's row list in line with `actorState` without rebuilding it.
 *
 * why keyed rather than replaced: a row's entrance animation runs when its
 * element is inserted. Rebuilding the list on every render would replay the
 * entrance of every row the reader has already seen.
 */
function reconcileRows(card: HTMLElement, actorState: ActorState, index: number): void {
  const list = card.querySelector<HTMLElement>('[data-part="card-rows"]');
  if (!list) return;

  const wanted = actorState.rows.map((row) => ({ ...row, key: `${row.since}|${row.text}` }));
  const keys = new Set(wanted.map((row) => row.key));
  for (const item of Array.from(list.children) as HTMLElement[]) {
    if (!keys.has(item.dataset.key ?? '')) item.remove();
  }

  wanted.forEach((row, position) => {
    let item = list.children[position] as HTMLElement | undefined;
    if (item?.dataset.key !== row.key) {
      const created = createPart('card-row', 'li', { text: row.text });
      created.dataset.key = row.key;
      list.insertBefore(created, item ?? null);
      item = created;
    }
    item.dataset.tone = row.tone;
    item.toggleAttribute('data-fresh', row.since === index && row.removedAt === null);
    item.toggleAttribute('data-removed', row.removedAt === index);
  });
}

/** The stage a scene starts from: everything before it, with removals settled. */
function stateBefore(
  actors: readonly ActorSpec[],
  scenes: readonly SceneSpec[],
  index: number,
): StageState {
  const state = stateAt(actors, scenes, index - 1);
  for (const actor of state.values()) {
    actor.rows = actor.rows.filter((row) => row.removedAt === null);
  }
  return state;
}

/** One line of the plain-text transcript under the stage. */
export function describeStep(
  step: MoveStep | ChangeStep,
  labelOf: (name: string) => string,
): string {
  if (step.type === 'move') {
    const outcome =
      step.result === 'accept' ? ' ✓ accepted' : step.result === 'reject' ? ' ✕ rejected' : '';
    const token = step.token === '•' ? '' : ` · ${step.token}`;
    return `${labelOf(step.from)} → ${labelOf(step.to)}${token}${outcome}`;
  }
  const parts: string[] = [];
  if (step.add !== null) parts.push(`+ ${step.add}`);
  if (step.remove !== null) parts.push(`− ${step.remove}`);
  if (step.set !== null) parts.push(step.set);
  if (step.drop) parts.push('dropped');
  return `${labelOf(step.actor)}: ${parts.join(' · ') || 'appears'}`;
}

function stepButton(part: string, label: string, glyph: SVGSVGElement): HTMLButtonElement {
  const button = createPart(part, 'button') as HTMLButtonElement;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(glyph);
  return button;
}

/** A card's rectangle relative to the stage's top-left corner. */
function boxWithin(element: Element, origin: DOMRect): Box {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
  };
}

/** Sampled positions along the curve, as transforms for the Web Animations API. */
function travelFrames(arc: Arc, token: HTMLElement): Keyframe[] {
  const halfWidth = token.offsetWidth / 2;
  const halfHeight = token.offsetHeight / 2;
  const frames: Keyframe[] = [];
  const samples = 20;
  for (let step = 0; step <= samples; step++) {
    const point = pointOnArc(arc, step / samples);
    frames.push({
      transform: `translate(${point.x - halfWidth}px, ${point.y - halfHeight}px)`,
      opacity: step === 0 ? 0 : 1,
    });
  }
  return frames;
}

/**
 * What a token does on arrival: an accepted one sinks into the card, a
 * rejected one recoils back along its path, a plain hand-off fades.
 */
function arrivalFrames(arc: Arc, token: HTMLElement, result: MoveStep['result']): Keyframe[] {
  const halfWidth = token.offsetWidth / 2;
  const halfHeight = token.offsetHeight / 2;
  const at = (t: number, extra = ''): string => {
    const point = pointOnArc(arc, t);
    return `translate(${point.x - halfWidth}px, ${point.y - halfHeight}px)${extra}`;
  };

  if (result === 'reject') {
    return [
      { transform: at(1), opacity: 1 },
      { transform: at(0.94, ' rotate(-8deg)'), opacity: 1, offset: 0.2 },
      { transform: at(0.98, ' rotate(8deg)'), opacity: 1, offset: 0.4 },
      { transform: at(0.7, ' rotate(-4deg)'), opacity: 0 },
    ];
  }
  if (result === 'accept') {
    return [
      { transform: at(1), opacity: 1 },
      { transform: at(1, ' scale(0.4)'), opacity: 0 },
    ];
  }
  return [
    { transform: at(1), opacity: 1 },
    { transform: at(1), opacity: 0 },
  ];
}

function arrivalTiming(step: MoveStep): KeyframeAnimationOptions {
  return { duration: step.result === 'reject' ? 700 : 380, easing: 'ease-out', fill: 'forwards' };
}

/** Draw the arrow's line from start to end. */
function revealArrow(arrow: SVGGElement): void {
  const line = arrow.querySelector('path');
  if (!line || typeof line.getTotalLength !== 'function') return;
  const length = line.getTotalLength();
  line.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
    duration: TRAVEL_MS * 0.6,
    easing: 'ease-out',
  }).onfinish = () => line.removeAttribute('style');
  line.style.strokeDasharray = `${length}`;
}

/** An animation's end, whether it finished or was cancelled. */
async function finished(animation: Animation): Promise<void> {
  try {
    await animation.finished;
  } catch {
    // Cancelled — the scene changed underneath it. Nothing to undo.
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function dwellFor(scene: SceneSpec | undefined): number {
  const words = (scene?.element.textContent ?? '').split(/\s+/).filter(Boolean).length;
  return Math.min(DWELL_BASE_MS + words * DWELL_PER_WORD_MS, DWELL_MAX_MS);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True when a key press belongs to a field the reader is typing into. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}
