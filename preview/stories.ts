/**
 * The stories, as Vite finds them: `stories/<tag>.html`, each loaded on demand.
 *
 * Both pages import this module and both accept its updates, so an edited
 * story arrives as an HMR update they handle themselves — the frame re-mounts
 * it in place — instead of Vite's fallback, a reload of every open page.
 */

const stories = import.meta.glob<string>('./stories/*.html', {
  query: '?raw',
  import: 'default',
});

/** Every story name: `doc-mindmap` for `stories/doc-mindmap.html`. */
export const STORY_NAMES: ReadonlySet<string> = new Set(
  Object.keys(stories).map((path) => path.replace(/^\.\/stories\/|\.html$/g, '')),
);

/** A story's markup, or undefined when there is no such story. */
export function loadStory(name: string): Promise<string> | undefined {
  return stories[`./stories/${name}.html`]?.();
}
