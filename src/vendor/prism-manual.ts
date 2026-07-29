/**
 * Turn off Prism's automatic highlighting *before* Prism itself evaluates.
 *
 * why a whole module for one assignment: `prism-core.js` reads
 * `window.Prism.manual` while it is initialising, so the flag has to be in place
 * before that module runs. ES module evaluation is depth-first in import order,
 * so importing this file first in `highlight.ts` is the only reliable way to
 * sequence it — an assignment in the same module would be hoisted past.
 *
 * Without it Prism walks the whole document on DOMContentLoaded looking for
 * `.language-*` elements, which in a plan document means re-highlighting every
 * block the runtime already handled.
 */

declare global {
  var Prism: { manual?: boolean } | undefined;
}

globalThis.Prism = { manual: true };

export {};
