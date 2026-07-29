/**
 * `<plan-stage title="…" subtitle="…" current open>` — one stage of a roadmap.
 *
 * The circular number badge, the sequence rail and the dark "current stage"
 * treatment are all runtime (§8.5). `current` implies `open`, because the stage
 * the reader is on is the one they came to read.
 */

import { PlanElement } from '../core/base.js';
import { isContentHidden, revealOnFindInPage, setContentHidden } from '../core/disclosure.js';
import { createPart, nameAuthorContent } from '../core/parts.js';
import { stageId } from '../core/slug.js';

export interface StageSetup {
  readonly number: number;
  readonly total: number;
}

/**
 * Number a stage and build its header.
 *
 * Exported as a function so `plan-roadmap` can call it without depending on
 * whether `plan-stage` has upgraded yet — the same pattern as `setupOption`.
 */
export function setupStage(stage: HTMLElement, setup: StageSetup): void {
  stage.dataset.number = String(setup.number);
  stage.dataset.total = String(setup.total);
  if (!stage.id) stage.id = stageId(stage.getAttribute('title') ?? '');

  if (stage instanceof PlanStage) {
    stage.renderHeader();
    return;
  }
  // Not upgraded yet: the attributes above are enough for its own enhance().
}

export class PlanStage extends PlanElement {
  protected enhance(): void {
    this.internals.role = 'listitem';
    nameAuthorContent(this, 'body');
    this.renderHeader();
    revealOnFindInPage(this, () => this.setOpen(true));
  }

  /** Idempotent — called by `plan-roadmap` and again by this element's upgrade. */
  renderHeader(): void {
    if (!this.findPart('header')) this.#buildHeader();
    this.setOpen(this.flag('open') || this.flag('current'));
    this.setState('current', this.flag('current'));
  }

  #buildHeader(): void {
    const header = createPart('header', 'button');
    header.setAttribute('type', 'button');

    const badge = createPart('badge', 'span', { text: this.dataset.number ?? '0' });
    badge.setAttribute('aria-hidden', 'true');

    const heading = createPart('heading', 'span');
    heading.append(createPart('title', 'span', { text: this.attr('title') }));

    const subtitle = this.attr('subtitle');
    if (subtitle) heading.append(createPart('subtitle', 'span', { text: subtitle }));

    header.append(badge, heading);
    if (this.flag('current'))
      header.append(createPart('current-marker', 'span', { text: 'Current' }));

    this.prepend(header);
    this.on(header, 'click', () => this.setOpen(!this.isOpen));
  }

  get isOpen(): boolean {
    return !isContentHidden(this);
  }

  setOpen(open: boolean): void {
    setContentHidden(this, !open);
    this.setState('open', open);
    this.findPart('header')?.setAttribute('aria-expanded', String(open));
  }
}
