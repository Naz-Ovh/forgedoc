/**
 * The component browser that `pnpm dev` opens at `/preview/`.
 *
 * A Svelte single-page app — sidebar, toolbar, canvas — for this repository's
 * development only. It never ships: nothing outside `preview/` imports it, and
 * the runtime it previews is loaded by the canvas, not by this page.
 */

import { mount } from 'svelte';

import App from './App.svelte';

mount(App, { target: document.body });
