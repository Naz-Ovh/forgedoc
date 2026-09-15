/**
 * Create the question drawer's host element and mount the Svelte app into it.
 *
 * MUST (§10.1): mounted as a plain Svelte 5 component via `mount()`, **not** as
 * a custom element — the same reason the bucket is. In custom element mode
 * Svelte inlines component styles as a JavaScript string rather than emitting a
 * CSS file, which would put the panel's styles outside `@layer` and out of reach
 * of both `--doc-*` tokens and the author's escape hatch.
 */

import { mount, unmount } from 'svelte';
import { storeFor } from '../core/store.js';
import QuestionDrawer from './QuestionDrawer.svelte';

export interface QuestionDrawerHandle {
  destroy(): void;
}

/** Mount the drawer into `host`, a `<div>` appended as a sibling of the content. */
export function mountQuestionDrawer(host: HTMLElement, docPage: HTMLElement): QuestionDrawerHandle {
  const app = mount(QuestionDrawer, {
    target: host,
    props: { docPage, store: storeFor(docPage) },
  });

  return {
    destroy(): void {
      void unmount(app);
    },
  };
}
