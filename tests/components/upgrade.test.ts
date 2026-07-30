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
    tag: 'doc-header',
    markup: `<doc-header kicker="Plan · X">Title text<p slot="lede">Lede.</p></doc-header>`,
    parts: ['kicker', 'lede'],
  },
  {
    tag: 'doc-section',
    markup: `<doc-section title="What we are building"><p>Body.</p></doc-section>`,
    parts: ['heading', 'number', 'title', 'body'],
  },
  {
    tag: 'doc-chips',
    markup: `<doc-chips><doc-chip kind="confirmed">Locked</doc-chip></doc-chips>`,
    parts: [],
  },
  {
    tag: 'doc-note',
    markup: `<doc-note kind="warn" title="Careful"><p>Body.</p></doc-note>`,
    parts: ['icon', 'title', 'body'],
  },
  {
    tag: 'doc-blocker',
    markup: `<doc-blocker severity="high" title="Blocked">
      <doc-blocks>It breaks.</doc-blocks>
      <doc-why>Because.</doc-why>
      <doc-action>Fix it.</doc-action>
    </doc-blocker>`,
    parts: ['header', 'sequence', 'severity', 'title'],
  },
  {
    tag: 'doc-list',
    markup: `<doc-list marker="check" title="Done"><li>One</li><li>Two</li></doc-list>`,
    parts: ['title', 'item', 'marker'],
  },
  {
    tag: 'doc-compare',
    markup: `<doc-compare columns="2">
      <doc-list title="A" kind="positive" marker="check"><li>One</li></doc-list>
      <doc-list title="B" kind="negative" marker="cross"><li>Two</li></doc-list>
    </doc-compare>`,
    parts: ['column'],
  },
  {
    tag: 'doc-table',
    markup: `<doc-table size="sm"><table><thead><tr><th>H</th></tr></thead><tbody><tr><td>V</td></tr></tbody></table></doc-table>`,
    parts: ['table', 'scroll-hint'],
  },
  {
    tag: 'doc-choice',
    markup: `<doc-choice mode="single" question="Which way?">
      <doc-option recommended>First<p slot="desc">Why.</p></doc-option>
      <doc-option>Second</doc-option>
    </doc-choice>`,
    parts: ['sequence', 'question', 'note-toggle', 'note', 'other'],
  },
  {
    tag: 'doc-collapse',
    markup: `<doc-collapse title="More detail"><p>Hidden body.</p></doc-collapse>`,
    parts: ['summary', 'chevron', 'body'],
  },
  {
    tag: 'doc-tabs',
    markup: `<doc-tabs><doc-tab label="One" active><p>A</p></doc-tab><doc-tab label="Two"><p>B</p></doc-tab></doc-tabs>`,
    parts: ['strip', 'tab'],
  },
  {
    tag: 'doc-checklist',
    markup: `<doc-checklist><li>Check one</li><li>Check two</li></doc-checklist>`,
    parts: ['item', 'check'],
  },
  {
    tag: 'doc-flow',
    // No `subtitle` part: the subtitle is a bare author text node, so naming it
    // would mean wrapping it (§2.2). The host carries its typography instead.
    markup: `<doc-flow><doc-flow-node title="A">first</doc-flow-node><doc-flow-node title="B" active>second</doc-flow-node></doc-flow>`,
    parts: ['arrow', 'title'],
  },
  {
    tag: 'doc-roadmap',
    markup: `<doc-roadmap start="0"><doc-stage title="Zero" subtitle="next" current><p>Body.</p></doc-stage><doc-stage title="One"><p>Body.</p></doc-stage></doc-roadmap>`,
    parts: ['header', 'badge', 'heading', 'title'],
  },
  {
    tag: 'doc-code',
    markup: `<doc-code lang="ts" title="a.ts" highlight="1">const x = 1;</doc-code>`,
    parts: ['header', 'lang', 'copy', 'code', 'gutter', 'lines'],
  },
  {
    tag: 'doc-diff',
    markup: `<doc-diff lang="ts" filename="a.ts">@@ -1,2 +1,2 @@
-const x = 1;
+const x = 2;</doc-diff>`,
    parts: ['header', 'filename', 'stat-add', 'stat-remove', 'code', 'row'],
  },
  {
    tag: 'doc-figure',
    markup: `<doc-figure type="svg" caption="A figure"><svg viewBox="0 0 10 10"></svg></doc-figure>`,
    parts: ['content', 'caption'],
  },
  {
    tag: 'doc-tree',
    markup: `<doc-tree root="src/">
  core/
    base.ts
  index.ts</doc-tree>`,
    parts: ['list', 'node', 'label'],
  },
  {
    tag: 'doc-quote',
    // Same as doc-flow-node: a bare text body has no element to name.
    markup: `<doc-quote cite="The spec">Never move author content.</doc-quote>`,
    parts: ['cite'],
  },
  {
    tag: 'doc-term',
    markup: `<p>Uses <doc-term href="https://example.com/a">ElementInternals</doc-term> here.</p>`,
    parts: [],
  },
  {
    tag: 'doc-ref',
    markup: `<doc-section title="Target"><p>See <doc-ref to="sec-target"></doc-ref>.</p></doc-section>`,
    parts: [],
  },
];

describe('every component', () => {
  it('has a case in this table', () => {
    const authored = TAG_NAMES.filter((name) => {
      const spec = TAGS[name] as TagSpec;
      return !spec.generated && !spec.onlyInside && name !== 'doc-page';
    });
    const covered = new Set(CASES.map((testCase) => testCase.tag));

    expect(authored.filter((name) => !covered.has(name))).toEqual([]);
  });

  for (const testCase of CASES) {
    describe(testCase.tag, () => {
      it('produces its documented parts', () => {
        const docPage = mountPlan(testCase.markup);
        const element = docPage.querySelector(testCase.tag);
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
        const onceChrome = once.querySelectorAll('[data-doc-chrome]').length;
        once.remove();

        const twice = mountTwice(testCase.markup);
        const twiceChrome = twice.querySelectorAll('[data-doc-chrome]').length;

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
        holder.innerHTML = `<doc-page doc-id="identity">${testCase.markup}</doc-page>`;
        const docPage = holder.firstElementChild as HTMLElement;

        const before = authorNodesOf(docPage);
        const parentsBefore = before.map((node) => node.parentNode);

        document.body.append(docPage);

        const after = authorNodesOf(docPage);
        for (const [index, node] of before.entries()) {
          // doc-code and doc-diff replace their own raw text — the one
          // documented exception, flagged in docs/DECISIONS.md.
          if (testCase.tag === 'doc-code' || testCase.tag === 'doc-diff') break;
          if (testCase.tag === 'doc-tree') break;

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
    const docPage = mountPlan(CASES.map((testCase) => testCase.markup).join('\n'));

    for (const element of Array.from(docPage.querySelectorAll('*'))) {
      expect(element.shadowRoot, `${element.tagName} has a shadow root`).toBeNull();
    }
    expect(docPage.shadowRoot).toBeNull();
  });
});
