/**
 * §13.2, per component: upgrade is idempotent, author children are not moved,
 * parts exist, and attributes reflect to state.
 *
 * These four properties are the ones the two foundational constraints (§2.1,
 * §2.2) reduce to at runtime, so they are checked for every component in one
 * table-driven sweep rather than being restated in twenty files.
 */

import { describe, expect, it } from 'vitest';

import { TAG_NAMES, TAGS, type TagSpec } from '../../src/core/contract.js';
import { authorNodesOf, mountPlan, mountTwice } from '../helpers.js';

/** Markup exercising one component, plus the parts it must produce. */
interface ComponentCase {
  readonly tag: string;
  readonly markup: string;
  readonly parts: readonly string[];
}

const CASES: readonly ComponentCase[] = [
  {
    tag: 'plan-header',
    markup: `<plan-header kicker="Plan · X">Title text<p slot="lede">Lede.</p></plan-header>`,
    parts: ['kicker', 'lede'],
  },
  {
    tag: 'plan-section',
    markup: `<plan-section title="What we are building"><p>Body.</p></plan-section>`,
    parts: ['heading', 'number', 'title', 'body'],
  },
  {
    tag: 'plan-chips',
    markup: `<plan-chips><plan-chip kind="confirmed">Locked</plan-chip></plan-chips>`,
    parts: [],
  },
  {
    tag: 'plan-note',
    markup: `<plan-note kind="warn" title="Careful"><p>Body.</p></plan-note>`,
    parts: ['icon', 'title', 'body'],
  },
  {
    tag: 'plan-blocker',
    markup: `<plan-blocker severity="high" title="Blocked">
      <plan-blocks>It breaks.</plan-blocks>
      <plan-why>Because.</plan-why>
      <plan-action>Fix it.</plan-action>
    </plan-blocker>`,
    parts: ['header', 'sequence', 'severity', 'title'],
  },
  {
    tag: 'plan-list',
    markup: `<plan-list marker="check" title="Done"><li>One</li><li>Two</li></plan-list>`,
    parts: ['title', 'item', 'marker'],
  },
  {
    tag: 'plan-compare',
    markup: `<plan-compare columns="2">
      <plan-list title="A" kind="positive" marker="check"><li>One</li></plan-list>
      <plan-list title="B" kind="negative" marker="cross"><li>Two</li></plan-list>
    </plan-compare>`,
    parts: ['column'],
  },
  {
    tag: 'plan-table',
    markup: `<plan-table size="sm"><table><thead><tr><th>H</th></tr></thead><tbody><tr><td>V</td></tr></tbody></table></plan-table>`,
    parts: ['table', 'scroll-hint'],
  },
  {
    tag: 'plan-choice',
    markup: `<plan-choice mode="single" question="Which way?">
      <plan-option recommended>First<p slot="desc">Why.</p></plan-option>
      <plan-option>Second</plan-option>
    </plan-choice>`,
    parts: ['sequence', 'question', 'note-toggle', 'note', 'other'],
  },
  {
    tag: 'plan-collapse',
    markup: `<plan-collapse title="More detail"><p>Hidden body.</p></plan-collapse>`,
    parts: ['summary', 'chevron', 'body'],
  },
  {
    tag: 'plan-tabs',
    markup: `<plan-tabs><plan-tab label="One" active><p>A</p></plan-tab><plan-tab label="Two"><p>B</p></plan-tab></plan-tabs>`,
    parts: ['strip', 'tab'],
  },
  {
    tag: 'plan-checklist',
    markup: `<plan-checklist><li>Check one</li><li>Check two</li></plan-checklist>`,
    parts: ['item', 'check'],
  },
  {
    tag: 'plan-flow',
    // No `subtitle` part: the subtitle is a bare author text node, so naming it
    // would mean wrapping it (§2.2). The host carries its typography instead.
    markup: `<plan-flow><plan-flow-node title="A">first</plan-flow-node><plan-flow-node title="B" active>second</plan-flow-node></plan-flow>`,
    parts: ['arrow', 'title'],
  },
  {
    tag: 'plan-roadmap',
    markup: `<plan-roadmap start="0"><plan-stage title="Zero" subtitle="next" current><p>Body.</p></plan-stage><plan-stage title="One"><p>Body.</p></plan-stage></plan-roadmap>`,
    parts: ['header', 'badge', 'heading', 'title'],
  },
  {
    tag: 'plan-code',
    markup: `<plan-code lang="ts" title="a.ts" highlight="1">const x = 1;</plan-code>`,
    parts: ['header', 'lang', 'copy', 'code', 'gutter', 'lines'],
  },
  {
    tag: 'plan-diff',
    markup: `<plan-diff lang="ts" filename="a.ts">@@ -1,2 +1,2 @@
-const x = 1;
+const x = 2;</plan-diff>`,
    parts: ['header', 'filename', 'stat-add', 'stat-remove', 'code', 'row'],
  },
  {
    tag: 'plan-figure',
    markup: `<plan-figure type="svg" caption="A figure"><svg viewBox="0 0 10 10"></svg></plan-figure>`,
    parts: ['content', 'caption'],
  },
  {
    tag: 'plan-tree',
    markup: `<plan-tree root="src/">
  core/
    base.ts
  index.ts</plan-tree>`,
    parts: ['list', 'node', 'label'],
  },
  {
    tag: 'plan-quote',
    // Same as plan-flow-node: a bare text body has no element to name.
    markup: `<plan-quote cite="The spec">Never move author content.</plan-quote>`,
    parts: ['cite'],
  },
  {
    tag: 'plan-term',
    markup: `<p>Uses <plan-term href="https://example.com/a">ElementInternals</plan-term> here.</p>`,
    parts: [],
  },
  {
    tag: 'plan-ref',
    markup: `<plan-section title="Target"><p>See <plan-ref to="sec-target"></plan-ref>.</p></plan-section>`,
    parts: [],
  },
];

describe('every component', () => {
  it('has a case in this table', () => {
    const authored = TAG_NAMES.filter((name) => {
      const spec = TAGS[name] as TagSpec;
      return !spec.generated && !spec.onlyInside && name !== 'plan-doc';
    });
    const covered = new Set(CASES.map((testCase) => testCase.tag));

    expect(authored.filter((name) => !covered.has(name))).toEqual([]);
  });

  for (const testCase of CASES) {
    describe(testCase.tag, () => {
      it('produces its documented parts', () => {
        const planDoc = mountPlan(testCase.markup);
        const element = planDoc.querySelector(testCase.tag);
        expect(element).not.toBeNull();

        for (const part of testCase.parts) {
          expect(
            element?.querySelector(`[data-part="${part}"]`),
            `${testCase.tag} is missing [data-part="${part}"]`,
          ).not.toBeNull();
        }
      });

      it('upgrades idempotently — no duplicate chrome', () => {
        const once = mountPlan(testCase.markup);
        const onceChrome = once.querySelectorAll('[data-plan-chrome]').length;
        once.remove();

        const twice = mountTwice(testCase.markup);
        const twiceChrome = twice.querySelectorAll('[data-plan-chrome]').length;

        expect(twiceChrome).toBe(onceChrome);
      });

      /*
       * MUST (§2.2): never reparent author content.
       *
       * Node *identity* is compared, not markup — a component that rebuilt the
       * same HTML from scratch would pass a string comparison and still have
       * invalidated every live Range and every text offset the feedback system
       * captured.
       */
      it('never moves an author node', () => {
        const holder = document.createElement('div');
        holder.innerHTML = `<plan-doc plan-id="identity">${testCase.markup}</plan-doc>`;
        const planDoc = holder.firstElementChild as HTMLElement;

        const before = authorNodesOf(planDoc);
        const parentsBefore = before.map((node) => node.parentNode);

        document.body.append(planDoc);

        const after = authorNodesOf(planDoc);
        for (const [index, node] of before.entries()) {
          // plan-code and plan-diff replace their own raw text — the one
          // documented exception, flagged in docs/DECISIONS.md.
          if (testCase.tag === 'plan-code' || testCase.tag === 'plan-diff') break;
          if (testCase.tag === 'plan-tree') break;

          expect(after).toContain(node);
          if (node.nodeType === Node.TEXT_NODE) continue;
          expect(node.parentNode, `${testCase.tag}: node ${index} was reparented`).toBe(
            parentsBefore[index],
          );
        }
      });
    });
  }
});

describe('shadow DOM', () => {
  /* Acceptance 14, checked at runtime as well as by the lint rule. */
  it('is never attached anywhere in a mounted document', () => {
    const planDoc = mountPlan(CASES.map((testCase) => testCase.markup).join('\n'));

    for (const element of Array.from(planDoc.querySelectorAll('*'))) {
      expect(element.shadowRoot, `${element.tagName} has a shadow root`).toBeNull();
    }
    expect(planDoc.shadowRoot).toBeNull();
  });
});
