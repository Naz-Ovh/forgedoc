/**
 * Entry point: import the stylesheet, define every element, expose the tiny
 * public API.
 *
 * MUST (§5.2): load this with `defer`, or from the end of `<body>`. Elements are
 * then defined after the document is parsed, so every element upgrades once,
 * synchronously, with all of its children already present. That eliminates the
 * classic light-DOM footgun where `connectedCallback` fires mid-parse and a
 * component sees an incomplete subtree — which is why no component in this
 * library needs a `MutationObserver` or a `setTimeout(0)`.
 */

/*
 * The reference theme, so `npm run dev` and the test suite have one compiled in
 * without a build step. It is also what tsdown emits as `dist/forgedoc.css`,
 * which keeps that filename meaning what it always meant.
 *
 * Every *other* theme is compiled by `npm run build:styles` into
 * `dist/themes/<name>.css` and selected at build time with
 * `forgedoc build --theme <name>` — themes are not swapped at runtime, so
 * nothing else is imported here.
 */
import './styles/themes/forgedoc/index.scss';

import { DocAction } from './components/doc-action.js';
import { DocBadge } from './components/doc-badge.js';
import { DocBlocker } from './components/doc-blocker.js';
import { DocBlocks } from './components/doc-blocks.js';
import { DocCaption } from './components/doc-caption.js';
import { DocCarousel } from './components/doc-carousel.js';
import { DocChecklist } from './components/doc-checklist.js';
import { DocChip } from './components/doc-chip.js';
import { DocChips } from './components/doc-chips.js';
import { DocChoice } from './components/doc-choice.js';
import { DocCode } from './components/doc-code.js';
import { DocCollapse } from './components/doc-collapse.js';
import { DocCompare } from './components/doc-compare.js';
import { DocDecision } from './components/doc-decision.js';
import { DocDiff } from './components/doc-diff.js';
import { DocEndpoint } from './components/doc-endpoint.js';
import { DocFigure } from './components/doc-figure.js';
import { DocFlow } from './components/doc-flow.js';
import { DocFlowNode } from './components/doc-flow-node.js';
import { DocHeader } from './components/doc-header.js';
import { DocList } from './components/doc-list.js';
import { DocMatrix } from './components/doc-matrix.js';
import { DocMilestone } from './components/doc-milestone.js';
import { DocNote } from './components/doc-note.js';
import { DocOption } from './components/doc-option.js';
import { DocOwner } from './components/doc-owner.js';
import { DocOwners } from './components/doc-owners.js';
import { DocPage } from './components/doc-page.js';
import { DocParam } from './components/doc-param.js';
import { DocParams } from './components/doc-params.js';
import { DocQuote } from './components/doc-quote.js';
import { DocRating } from './components/doc-rating.js';
import { DocRef } from './components/doc-ref.js';
import { DocRoadmap } from './components/doc-roadmap.js';
import { DocSection } from './components/doc-section.js';
import { DocStage } from './components/doc-stage.js';
import { DocStat } from './components/doc-stat.js';
import { DocStats } from './components/doc-stats.js';
import { DocStep } from './components/doc-step.js';
import { DocSteps } from './components/doc-steps.js';
import { DocTab } from './components/doc-tab.js';
import { DocTable } from './components/doc-table.js';
import { DocTabs } from './components/doc-tabs.js';
import { DocTerm } from './components/doc-term.js';
import { DocTimeline } from './components/doc-timeline.js';
import { DocToc } from './components/doc-toc.js';
import { DocTree } from './components/doc-tree.js';
import { DocWhy } from './components/doc-why.js';
import { TAG_NAMES } from './core/contract.js';
import { define } from './core/registry.js';
import { storeFor } from './core/store.js';
import type { DocStore } from './core/types.js';

/**
 * The whole vocabulary, tag name → constructor.
 *
 * Order is not load-bearing — every component that needs a document-wide fact
 * asks `indexFor()` for it, which builds the index on first use whoever asks
 * first. Listed alphabetically so a missing entry is obvious.
 */
const ELEMENTS = {
  'doc-action': DocAction,
  'doc-badge': DocBadge,
  'doc-blocker': DocBlocker,
  'doc-blocks': DocBlocks,
  'doc-caption': DocCaption,
  'doc-carousel': DocCarousel,
  'doc-checklist': DocChecklist,
  'doc-chip': DocChip,
  'doc-chips': DocChips,
  'doc-choice': DocChoice,
  'doc-code': DocCode,
  'doc-collapse': DocCollapse,
  'doc-compare': DocCompare,
  'doc-decision': DocDecision,
  'doc-diff': DocDiff,
  'doc-endpoint': DocEndpoint,
  'doc-figure': DocFigure,
  'doc-flow': DocFlow,
  'doc-flow-node': DocFlowNode,
  'doc-header': DocHeader,
  'doc-list': DocList,
  'doc-matrix': DocMatrix,
  'doc-milestone': DocMilestone,
  'doc-note': DocNote,
  'doc-option': DocOption,
  'doc-owner': DocOwner,
  'doc-owners': DocOwners,
  'doc-page': DocPage,
  'doc-param': DocParam,
  'doc-params': DocParams,
  'doc-quote': DocQuote,
  'doc-rating': DocRating,
  'doc-ref': DocRef,
  'doc-roadmap': DocRoadmap,
  'doc-section': DocSection,
  'doc-stage': DocStage,
  'doc-stat': DocStat,
  'doc-stats': DocStats,
  'doc-step': DocStep,
  'doc-steps': DocSteps,
  'doc-tab': DocTab,
  'doc-table': DocTable,
  'doc-tabs': DocTabs,
  'doc-term': DocTerm,
  'doc-timeline': DocTimeline,
  'doc-toc': DocToc,
  'doc-tree': DocTree,
  'doc-why': DocWhy,
} as const;

/** Register every element. Safe to call twice (§7.2). */
export function defineAll(): void {
  for (const [tagName, elementConstructor] of Object.entries(ELEMENTS)) {
    define(tagName, elementConstructor);
  }
}

/*
 * ── The public API ────────────────────────────────────────────────────────
 *
 * These are deliberately *top-level* named exports rather than members of a
 * `ForgeDoc` object.
 *
 * why (§4.2): the IIFE builds emit `var ForgeDoc = (function (exports) { … })({})`,
 * so the global `ForgeDoc` **is** this module's namespace. Wrapping the API in an
 * inner object would make the documented call `ForgeDoc.chips.add(…)` resolve to
 * `ForgeDoc.ForgeDoc.chips.add(…)` — and assigning `window.ForgeDoc` from inside
 * the IIFE does not help, because the wrapper overwrites it the moment it
 * returns. That bug was caught by opening a built document from `file://`.
 *
 * Exporting the members directly makes `window.ForgeDoc.chips.add(…)` in an
 * offline document and `import { chips } from 'forgedoc'` in a bundler
 * exactly the same API.
 */

export const version: string = __FORGEDOC_VERSION__;

/** Tag names the contract knows about, including generated and child-only ones. */
export const vocabulary: readonly string[] = TAG_NAMES;

export const chips = {
  /**
   * Append a chip at runtime (§8.2).
   *
   * why this is public: when a feedback bucket is pasted back and the agent
   * regenerates, previously answered questions surface as `confirmed` chips.
   * Tooling can do that without a full regeneration.
   */
  add(chip: { kind: string; text: string }, docPage?: Element): HTMLElement | null {
    const root = docPage ?? document.querySelector('doc-page');
    if (!root) return null;

    const chipRow = root.querySelector('doc-chips') as
      | (Element & { addChip?: (kind: string, text: string) => HTMLElement })
      | null;
    if (!chipRow?.addChip) return null;
    return chipRow.addChip(chip.kind, chip.text);
  },
};

/** The store for a document, for tooling that wants to read or seed state. */
export function store(docPage?: Element): DocStore | null {
  const root = docPage ?? document.querySelector('doc-page');
  return root ? storeFor(root) : null;
}

defineAll();
