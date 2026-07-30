/**
 * `<doc-blocks>` — what a roadblock breaks. Required inside `doc-blocker`.
 *
 * The three roadblock children share one shape: a generated label followed by
 * the author's text, styled as a definition row.
 */

import { DocElement } from '../core/base.js';
import { labelRoadblockPart } from './doc-action.js';

export class DocBlocks extends DocElement {
  protected enhance(): void {
    labelRoadblockPart(this, 'Blocks');
  }
}
