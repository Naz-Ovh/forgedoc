/**
 * What the sidebar and toolbar show, derived from the tag contract so it cannot
 * drift from it: the groups and order of `REFERENCE.md`, each tag's one-line
 * description, and the child tags a story necessarily includes.
 *
 * Child-only tags (`doc-option`, `doc-stat`, …) get no story of their own: they
 * are only valid inside a parent, so they appear in the parent's story.
 */

import { TAG_NAMES, TAGS, type TagName, type TagSpec } from '../src/core/contract.js';
import { CATEGORIES } from '../tools/element-docs.js';
import { STORY_NAMES } from './stories.js';

export interface Entry {
  readonly name: string;
  /** False until `stories/<name>.html` exists; the sidebar shows it muted. */
  readonly hasStory: boolean;
}

export interface Group {
  readonly title: string;
  readonly entries: readonly Entry[];
}

/** A run of description text, or a backtick span to render as code. */
export interface Part {
  readonly text: string;
  readonly code: boolean;
}

const specOf = (name: string): TagSpec | undefined =>
  name in TAGS ? (TAGS[name as TagName] as TagSpec) : undefined;

/** Authored, and valid outside any particular parent. */
const standalone = (name: TagName): boolean =>
  name !== 'doc-page' && specOf(name)?.generated !== true && specOf(name)?.onlyInside === undefined;

if (import.meta.hot) {
  // An edited story changes its markup, not the list, and the canvas re-mounts
  // it (canvas.ts). Stopping the update here keeps Svelte from re-rendering the
  // app, which would recreate the canvas iframe and so reload it.
  import.meta.hot.accept('./stories.js', () => {});
}

export const hasStory = (name: string): boolean => STORY_NAMES.has(name);

const entry = (name: string): Entry => ({ name, hasStory: hasStory(name) });

/** The sidebar: every standalone tag by group, then stories that are not a tag. */
export function storyGroups(): Group[] {
  const groups = CATEGORIES.map((category) => ({
    title: category.title,
    entries: category.tags.filter(standalone).map(entry),
  }));

  const grouped = new Set(groups.flatMap((group) => group.entries.map(({ name }) => name)));
  const other = [...STORY_NAMES].filter((name) => !grouped.has(name)).sort();
  if (other.length > 0) groups.push({ title: 'Other', entries: other.map(entry) });
  return groups;
}

/** Child-only tags that a story for `name` necessarily shows. */
export function childrenOf(name: string): TagName[] {
  const direct = TAG_NAMES.filter(
    (child) => child !== name && specOf(child)?.onlyInside?.includes(name) === true,
  );
  return [...new Set(direct.flatMap((child) => [child, ...childrenOf(child)]))];
}

/** The contract's one-line description, split at its backtick spans. */
export function describe(name: string): Part[] {
  const doc = specOf(name)?.doc ?? '';
  return doc.split('`').map((text, index) => ({ text, code: index % 2 === 1 }));
}
