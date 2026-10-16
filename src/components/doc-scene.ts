/**
 * `<doc-scene title="…">` — one step of a `doc-walkthrough`.
 *
 * Its `doc-move` and `doc-change` children are the motion; everything else in
 * it is the caption, written as ordinary prose and shown under the stage while
 * the scene is current. The walkthrough decides which scene is visible; this
 * element only names itself and takes comments.
 *
 * Parts: `scene-title`, `feedback`.
 */

import { DocElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart } from '../core/parts.js';

export class DocScene extends DocElement {
  protected enhance(): void {
    const title = this.attr('title');
    if (title) this.prepend(createPart('scene-title', 'span', { text: title }));

    // A reader who disagrees with a step disagrees with the whole scene, so the
    // scene is the unit a comment attaches to — named with the walkthrough it
    // belongs to, since "Wrong door" alone means nothing in the bucket.
    const walkthrough = this.closest('doc-walkthrough')?.getAttribute('title')?.trim();
    appendFeedbackButton(this, walkthrough ? `${walkthrough} › ${title}` : title, { icon: true });
  }
}
