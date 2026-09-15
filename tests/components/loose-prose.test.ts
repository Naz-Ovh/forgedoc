/**
 * An agent writes a component body the way it writes a sentence:
 *
 *     <doc-step title="Devices">The <code>push_devices</code> migration.</doc-step>
 *
 * which is three children — text, `<code>`, text — not one. Two separate bugs
 * came out of that shape and both rendered the sentence as a stack of rows:
 *
 *   1. `nameAuthorContent` named every element child as the body part, so the
 *      `<code>` picked up the body's *block* typography mid-sentence.
 *   2. The host was a grid or a column flex container, so each child became a
 *      layout item and every run of text between them became an anonymous one
 *      that no selector could reach or correct.
 *
 * Neither is fixable by wrapping the prose — §2.2 forbids moving author nodes —
 * so both fixes are structural, and these tests pin them. Running in a real
 * browser matters here: the second bug is invisible to any DOM-only assertion.
 *
 * The disclosures are the documented exception, and the last block here covers
 * them: a panel closes by putting `hidden` on its content, an attribute needs
 * an element, so `ensureContentElement` builds one. See `core/disclosure.ts`.
 */

import { describe, expect, it } from 'vitest';
import { authorNodesOf, mountPlan } from '../helpers.js';

interface ProseHost {
  readonly tag: string;
  readonly markup: string;
  /**
   * `doc-option` is the exception: §8.4 keeps its label a bare text node and it
   * never names a body, so the label typography already lives on the host and
   * there is nothing for `data-doc-flow` to switch on.
   */
  readonly namesBody?: false;
}

/** Components whose body the author may write as loose prose. */
const PROSE_HOSTS: readonly ProseHost[] = [
  {
    tag: 'doc-step',
    markup: `<doc-steps><doc-step title="Devices">The <code>push_devices</code> migration.</doc-step></doc-steps>`,
  },
  {
    tag: 'doc-milestone',
    markup: `<doc-timeline><doc-milestone date="2026-Q3" title="Launch">Ship <code>v1</code> behind a flag.</doc-milestone></doc-timeline>`,
  },
  {
    tag: 'doc-stat',
    markup: `<doc-stats><doc-stat label="Latency" value="42ms">Measured at <code>p95</code> weekly.</doc-stat></doc-stats>`,
  },
  {
    tag: 'doc-param',
    markup: `<doc-params><doc-param name="id" type="string">The unique <code>ULID</code> for it.</doc-param></doc-params>`,
  },
  {
    tag: 'doc-option',
    markup: `<doc-choice question="Which?"><doc-option>Add the <code>language</code> column<p slot="desc">A description.</p></doc-option><doc-option>Do nothing</doc-option></doc-choice>`,
    namesBody: false,
  },
];

/** The author's own `<code>`, not the `<code>` `doc-param` builds for its name. */
function authorCode(host: Element): HTMLElement {
  const code = Array.from(host.querySelectorAll<HTMLElement>('code')).find(
    (element) => element.dataset.docChrome === undefined,
  );
  if (!code) throw new Error('the author’s <code> is gone');
  return code;
}

/** The first run of bare text the author wrote directly inside `host`. */
function firstLooseTextRect(host: Element): DOMRect {
  for (const node of Array.from(host.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    if (!node.textContent?.trim()) continue;

    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getClientRects()[0];
    if (rect) return rect;
  }
  throw new Error('no loose text to measure');
}

describe('a component body written as loose prose', () => {
  for (const { tag, markup, namesBody } of PROSE_HOSTS) {
    describe(tag, () => {
      it('leaves inline markup inline', () => {
        const docPage = mountPlan(markup);
        const code = authorCode(docPage.querySelector(tag) as HTMLElement);

        // The bug: `<code>` was named as the body and took its block display.
        expect(code.dataset.part).toBeUndefined();
        expect(getComputedStyle(code).display).toBe('inline');

        docPage.remove();
      });

      it('is not a layout container, so the runs stay one sentence', () => {
        const docPage = mountPlan(markup);
        const host = docPage.querySelector(tag) as HTMLElement;

        // MUST: loose text between two element children of a grid or flex box
        // becomes an anonymous item on a row of its own, and no rule can reach
        // it to put it back. A block host is the only shape that cannot break.
        expect(['grid', 'inline-grid', 'flex', 'inline-flex']).not.toContain(
          getComputedStyle(host).display,
        );

        // The observable consequence: the words before the chip share its line.
        const text = firstLooseTextRect(host);
        const code = authorCode(host).getBoundingClientRect();
        expect(text.top, 'the text before the chip was pushed onto its own row').toBeLessThan(
          code.bottom,
        );
        expect(text.bottom).toBeGreaterThan(code.top);

        docPage.remove();
      });

      it('moves nothing (§2.2)', () => {
        const docPage = mountPlan(markup);
        const host = docPage.querySelector(tag) as HTMLElement;
        const before = authorNodesOf(host);

        for (const node of before) {
          expect(node.isConnected, 'an author node was detached').toBe(true);
        }
        // Identity *and* parentage: `doc-step` used to move its first child
        // into a generated card and leave the rest of the sentence behind.
        expect(authorNodesOf(host)).toEqual(before);

        docPage.remove();
      });

      if (namesBody !== false) {
        it('marks the host so a stylesheet can paint the body', () => {
          const docPage = mountPlan(markup);

          // There is no element to name, so the typography has to go somewhere.
          expect((docPage.querySelector(tag) as HTMLElement).dataset.docFlow).toBe('');

          docPage.remove();
        });
      }
    });
  }
});

describe('a body written as block elements', () => {
  it('still gets a named body part, and no flow marker', () => {
    const docPage = mountPlan(
      `<doc-steps><doc-step title="Devices"><p>The migration.</p></doc-step></doc-steps>`,
    );
    const paragraph = docPage.querySelector('doc-step p') as HTMLElement;

    expect(paragraph.dataset.part).toBe('body');
    expect(docPage.querySelector<HTMLElement>('doc-step')?.dataset.docFlow).toBeUndefined();

    docPage.remove();
  });
});

describe('doc-figure', () => {
  it('names an <svg> as content even though svg is phrasing content', () => {
    const docPage = mountPlan(
      `<doc-figure type="svg" caption="A figure"><svg viewBox="0 0 10 10"></svg></doc-figure>`,
    );
    const svg = docPage.querySelector('doc-figure svg') as SVGElement;

    // The figure's body *is* the embedded object, which is why it opts in.
    expect(svg.dataset.part).toBe('content');
    expect(docPage.querySelector<HTMLElement>('doc-figure')?.dataset.docFlow).toBeUndefined();

    docPage.remove();
  });
});

describe('a disclosure written as loose prose', () => {
  it('actually closes', async () => {
    const docPage = mountPlan(
      `<doc-collapse title="Detail">Bare text with <code>a chip</code>.</doc-collapse>`,
    );
    const collapse = docPage.querySelector('doc-collapse') as HTMLElement;
    const body = collapse.querySelector('[data-part="body"]') as HTMLElement;

    // The bug: there was no element to put `hidden` on, so the chevron turned
    // and the words stayed on screen.
    expect(body.getAttribute('hidden')).toBe('until-found');
    expect(body.textContent).toContain('Bare text with a chip.');

    // And closed takes no space — `content-visibility: hidden` keeps the box.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(body.getBoundingClientRect().height).toBe(0);

    docPage.remove();
  });

  it('keeps the text findable while closed', () => {
    const docPage = mountPlan(
      `<doc-collapse title="Detail">Bare text with <code>a chip</code>.</doc-collapse>`,
    );
    const body = docPage.querySelector('[data-part="body"]') as HTMLElement;

    // MUST (acceptance 4): `until-found`, never `display: none` — the value is
    // what lets Ctrl+F reach in and fire `beforematch` to reopen the panel.
    expect(body.getAttribute('hidden')).toBe('until-found');
    expect(getComputedStyle(body).display).not.toBe('none');

    docPage.remove();
  });

  it('gives content already in blocks the same single region', () => {
    const docPage = mountPlan(
      `<doc-collapse title="Detail" open><p>One.</p><p>Two.</p></doc-collapse>`,
    );
    const collapse = docPage.querySelector('doc-collapse') as HTMLElement;

    // One region, not one per paragraph: the inset and the rule under the
    // trigger are drawn once.
    const bodies = collapse.querySelectorAll(':scope > [data-part="body"]');
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.children).toHaveLength(2);

    docPage.remove();
  });

  it('leaves the text unchanged, so highlight offsets still resolve', () => {
    const source = `<doc-collapse title="Detail">Bare text with <code>a chip</code>.</doc-collapse>`;
    const docPage = mountPlan(source);
    const collapse = docPage.querySelector('doc-collapse') as HTMLElement;

    // Highlights anchor by character offset into `textContent` (§10.2), which
    // is why giving the body a container is safe here.
    const body = collapse.querySelector('[data-part="body"]') as HTMLElement;
    expect(body.textContent).toBe('Bare text with a chip.');

    docPage.remove();
  });
});
