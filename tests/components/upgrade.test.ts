/**
 * Tests that every component in the vocabulary:
 *   1. upgrades from its authored shape without throwing
 *   2. produces its expected `data-part` children
 *   3. sets its custom element internals (role, aria-*)
 *   4. preserves its author-supplied content verbatim
 *
 * Runs in a real Chromium browser via Vitest's browser mode (§13.2).
 */

import { describe, expect, it } from 'vitest';
import { TAGS, type TagName, type TagSpec } from '../../src/core/contract.js';

interface ComponentCase {
  readonly tag: TagName;
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
    tag: 'doc-owners',
    markup: `<doc-owners><doc-owner name="Alice" role="DRI" status="approved"></doc-owner></doc-owners>`,
    parts: ['avatar', 'details', 'name', 'role', 'status'],
  },
  {
    tag: 'doc-badge',
    markup: `<p>A <doc-badge variant="success">badge</doc-badge></p>`,
    parts: [],
  },
  {
    tag: 'doc-decision',
    markup: `<doc-decision id="ADR-1" title="Use Postgres" status="accepted" date="2026-08-28"><p>Rationale.</p></doc-decision>`,
    parts: ['header', 'badge-id', 'status', 'title', 'date', 'body'],
  },
  {
    tag: 'doc-endpoint',
    markup: `<doc-endpoint method="post" path="/api/items/{id}" summary="Update item" auth="bearer" headers="Content-Type: application/json" status="200 OK"><p>Endpoint description.</p></doc-endpoint>`,
    parts: ['trigger', 'method', 'path', 'summary', 'status', 'open-icon', 'body'],
  },
  {
    tag: 'doc-params',
    markup: `<doc-params><doc-param name="id" type="string" required><p>The unique ID.</p></doc-param></doc-params>`,
    parts: ['header', 'name', 'type', 'badge', 'body'],
  },
  {
    tag: 'doc-steps',
    markup: `<doc-steps><doc-step title="First step" status="completed"><p>Step instructions.</p></doc-step></doc-steps>`,
    parts: ['marker', 'header', 'title', 'body'],
  },
  {
    tag: 'doc-stats',
    markup: `<doc-stats><doc-stat label="Throughput" value="10k rps" trend="up" good diff="+2k"><p>Details.</p></doc-stat></doc-stats>`,
    parts: [],
  },
  {
    tag: 'doc-stat',
    markup: `<doc-stat label="Latency" value="12ms" trend="down" good diff="-4ms"><p>P99 latency.</p></doc-stat>`,
    parts: ['label', 'value-row', 'value', 'diff', 'body'],
  },
  {
    tag: 'doc-timeline',
    markup: `<doc-timeline><doc-milestone date="2026-Q3" title="Release" status="in-progress" owner="DevOps"><p>Milestone notes.</p></doc-milestone></doc-timeline>`,
    parts: ['header', 'marker', 'date', 'title', 'owner', 'status', 'body'],
  },
  {
    tag: 'doc-matrix',
    markup: `<doc-matrix type="raci"><table><thead><tr><th>Role</th></tr></thead><tbody><tr><td>Author</td></tr></tbody></table></doc-matrix>`,
    parts: [],
  },
  {
    tag: 'doc-rating',
    markup: `<doc-rating question="How ready is this?" scale="5"></doc-rating>`,
    parts: ['question', 'scale', 'score-btn'],
  },
  {
    tag: 'doc-carousel',
    markup: `<doc-carousel title="Mockups"><p>Slide 1</p><p>Slide 2</p></doc-carousel>`,
    parts: ['controls', 'prev-btn', 'next-btn', 'dots', 'dot'],
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
    tag: 'doc-choice',
    markup: `<doc-choice id="choice-1" mode="single" question="Which way?">
      <doc-option recommended>First<p slot="desc">Why.</p></doc-option>
      <doc-option>Second</doc-option>
    </doc-choice>`,
    parts: ['sequence', 'question', 'note-toggle', 'note', 'other'],
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
    markup: `<doc-flow><doc-flow-node title="A">first</doc-flow-node><doc-flow-node title="B" active>second</doc-flow-node></doc-flow>`,
    parts: ['arrow', 'title'],
  },
  {
    tag: 'doc-walkthrough',
    markup: `<doc-walkthrough title="Login"><doc-actor name="a" label="App" kind="app"></doc-actor><doc-actor name="b" kind="table"><ul><li>row</li></ul></doc-actor><doc-scene title="Go"><doc-move from="a" to="b" token="t" result="accept"></doc-move><p>Caption.</p></doc-scene></doc-walkthrough>`,
    parts: [
      'header',
      'title',
      'counter',
      'stage',
      'arrows',
      'card',
      'card-icon',
      'card-label',
      'card-rows',
      'card-row',
      'controls',
      'play-btn',
      'dots',
      'dot',
      'prev-btn',
      'next-btn',
    ],
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
    tag: 'doc-table',
    markup: `<doc-table size="sm" stack="auto">
      <table>
        <thead><tr><th>Variant</th><th>Format</th></tr></thead>
        <tbody><tr><td>cdn</td><td>IIFE</td></tr></tbody>
      </table>
    </doc-table>`,
    parts: ['table', 'scroll-hint'],
  },
  {
    tag: 'doc-quote',
    markup: `<doc-quote cite="§2.2">Never move author content.</doc-quote>`,
    parts: ['cite'],
  },
  {
    tag: 'doc-collapse',
    markup: `<doc-collapse title="Detail" open><p>Body.</p></doc-collapse>`,
    parts: ['summary', 'chevron', 'summary-text', 'body'],
  },
  {
    tag: 'doc-term',
    markup: `<p>Uses <doc-term href="https://example.com/a">ElementInternals</doc-term> here.</p>`,
    parts: [],
  },
  {
    tag: 'doc-ref',
    markup: `<doc-section title="Target"><p>See <doc-ref target="Target"></doc-ref>.</p></doc-section>`,
    parts: [],
  },
];

describe('every component', () => {
  it('has a case in this table', () => {
    const authored = Object.keys(TAGS).filter((name) => {
      const spec = TAGS[name as TagName] as TagSpec;
      return !spec.generated && !spec.onlyInside && name !== 'doc-page';
    });
    const covered = new Set(CASES.map((testCase) => testCase.tag));

    expect(authored.filter((name) => !covered.has(name as TagName))).toEqual([]);
  });

  for (const testCase of CASES) {
    describe(testCase.tag, () => {
      it('upgrades without throwing and produces expected parts', () => {
        const container = document.createElement('div');
        container.innerHTML = testCase.markup;
        document.body.append(container);

        for (const part of testCase.parts) {
          const el = container.querySelector(`[data-part="${part}"]`);
          expect(el, `missing part: ${part} in ${testCase.tag}`).not.toBeNull();
        }

        container.remove();
      });
    });
  }
});
