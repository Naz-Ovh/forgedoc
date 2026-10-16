/**
 * `<doc-move from="…" to="…" token="…" result="accept|reject">` — a token
 * travelling between two actors during a `doc-scene`.
 *
 * Data only: `doc-walkthrough` reads it, animates it, and writes its line in
 * the transcript under the stage.
 */

import { DocElement } from '../core/base.js';

export class DocMove extends DocElement {
  protected enhance(): void {}
}
