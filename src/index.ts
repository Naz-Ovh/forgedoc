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

import './styles/index.css';

import { PlanAction } from './components/plan-action.js';
import { PlanBlocker } from './components/plan-blocker.js';
import { PlanBlocks } from './components/plan-blocks.js';
import { PlanCaption } from './components/plan-caption.js';
import { PlanChecklist } from './components/plan-checklist.js';
import { PlanChip } from './components/plan-chip.js';
import { PlanChips } from './components/plan-chips.js';
import { PlanChoice } from './components/plan-choice.js';
import { PlanCode } from './components/plan-code.js';
import { PlanCollapse } from './components/plan-collapse.js';
import { PlanCompare } from './components/plan-compare.js';
import { PlanDiff } from './components/plan-diff.js';
import { PlanDoc } from './components/plan-doc.js';
import { PlanFigure } from './components/plan-figure.js';
import { PlanFlow } from './components/plan-flow.js';
import { PlanFlowNode } from './components/plan-flow-node.js';
import { PlanHeader } from './components/plan-header.js';
import { PlanList } from './components/plan-list.js';
import { PlanNote } from './components/plan-note.js';
import { PlanOption } from './components/plan-option.js';
import { PlanQuote } from './components/plan-quote.js';
import { PlanRef } from './components/plan-ref.js';
import { PlanRoadmap } from './components/plan-roadmap.js';
import { PlanSection } from './components/plan-section.js';
import { PlanStage } from './components/plan-stage.js';
import { PlanTab } from './components/plan-tab.js';
import { PlanTable } from './components/plan-table.js';
import { PlanTabs } from './components/plan-tabs.js';
import { PlanTerm } from './components/plan-term.js';
import { PlanToc } from './components/plan-toc.js';
import { PlanTree } from './components/plan-tree.js';
import { PlanWhy } from './components/plan-why.js';
import { TAG_NAMES } from './core/contract.js';
import { define, registeredTags } from './core/registry.js';
import { storeFor } from './core/store.js';
import type { PlanStore } from './core/types.js';

/**
 * The whole vocabulary, tag name → constructor.
 *
 * Order is not load-bearing — every component that needs a document-wide fact
 * asks `indexFor()` for it, which builds the index on first use whoever asks
 * first. Listed alphabetically so a missing entry is obvious.
 */
const ELEMENTS = {
  'plan-action': PlanAction,
  'plan-blocker': PlanBlocker,
  'plan-blocks': PlanBlocks,
  'plan-caption': PlanCaption,
  'plan-checklist': PlanChecklist,
  'plan-chip': PlanChip,
  'plan-chips': PlanChips,
  'plan-choice': PlanChoice,
  'plan-code': PlanCode,
  'plan-collapse': PlanCollapse,
  'plan-compare': PlanCompare,
  'plan-diff': PlanDiff,
  'plan-doc': PlanDoc,
  'plan-figure': PlanFigure,
  'plan-flow': PlanFlow,
  'plan-flow-node': PlanFlowNode,
  'plan-header': PlanHeader,
  'plan-list': PlanList,
  'plan-note': PlanNote,
  'plan-option': PlanOption,
  'plan-quote': PlanQuote,
  'plan-ref': PlanRef,
  'plan-roadmap': PlanRoadmap,
  'plan-section': PlanSection,
  'plan-stage': PlanStage,
  'plan-tab': PlanTab,
  'plan-table': PlanTable,
  'plan-tabs': PlanTabs,
  'plan-term': PlanTerm,
  'plan-toc': PlanToc,
  'plan-tree': PlanTree,
  'plan-why': PlanWhy,
} as const;

/** Register every element. Safe to call twice (§7.2). */
export function defineAll(): void {
  for (const [tagName, elementConstructor] of Object.entries(ELEMENTS)) {
    define(tagName, elementConstructor);
  }
}

/*
 * ── The public API ──────────────────────────────────────────────────────────
 *
 * These are deliberately *top-level* named exports rather than members of a
 * `PlanKit` object.
 *
 * why (§4.2): the IIFE builds emit `var PlanKit = (function (exports) { … })({})`,
 * so the global `PlanKit` **is** this module's namespace. Wrapping the API in an
 * inner object would make the documented call `PlanKit.chips.add(…)` resolve to
 * `PlanKit.PlanKit.chips.add(…)` — and assigning `window.PlanKit` from inside
 * the IIFE does not help, because the wrapper overwrites it the moment it
 * returns. That bug was caught by opening a built document from `file://`.
 *
 * Exporting the members directly makes `window.PlanKit.chips.add(…)` in an
 * offline document and `import { chips } from 'plankit'` in a bundler
 * exactly the same API.
 */

export const version: string = __PLANKIT_VERSION__;

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
  add(chip: { kind: string; text: string }, planDoc?: Element): HTMLElement | null {
    const root = planDoc ?? document.querySelector('plan-doc');
    if (!root) return null;

    const chipRow = root.querySelector('plan-chips') as
      | (Element & { addChip?: (kind: string, text: string) => HTMLElement })
      | null;
    if (!chipRow?.addChip) return null;
    return chipRow.addChip(chip.kind, chip.text);
  },
};

/** The store for a document, for tooling that wants to read or seed state. */
export function store(planDoc?: Element): PlanStore | null {
  const root = planDoc ?? document.querySelector('plan-doc');
  return root ? storeFor(root) : null;
}

defineAll();

export { parseBucket, serializeBucket } from './bucket/serialize.js';
export { PlanChoice } from './components/plan-choice.js';
export { PlanDoc } from './components/plan-doc.js';
export { PlanSection } from './components/plan-section.js';
export { CODE_LANGUAGES, PRESET_AXES, TAG_NAMES, TAGS } from './core/contract.js';
export * from './core/types.js';
export { registeredTags };
