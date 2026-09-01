/**
 * The documentation commands, and the invariant that makes them trustworthy:
 * every one of them is derived from `src/core/contract.ts`, so the docs cannot
 * describe markup the validator would reject.
 *
 * The tests that matter most here are not the rendering ones. They are the
 * coverage checks — a tag added to the contract with no category, no example or
 * no parts entry fails immediately, which is the only thing standing between
 * this and the hand-maintained cheatsheet that drifted before it.
 */

import { describe, expect, it } from 'vitest';

import {
  PARTS,
  STATES,
  TAG_NAMES,
  TAGS,
  type TagName,
  type TagSpec,
} from '../../src/core/contract.js';
import {
  elementDetail,
  elementSummaries,
  normaliseTag,
  renderElements,
  renderInfo,
  renderReference,
  renderSearch,
  searchDocs,
  suggestTags,
} from '../../tools/docs.js';
import {
  CATEGORIES,
  DOCUMENTED_TAGS,
  ELEMENT_DOCS,
  undocumentedTags,
} from '../../tools/element-docs.js';

describe('documentation coverage', () => {
  it('files every tag in exactly one category', () => {
    expect(undocumentedTags(), 'Missing from CATEGORIES in tools/element-docs.ts').toEqual([]);

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const tag of DOCUMENTED_TAGS) {
      if (seen.has(tag)) duplicates.push(tag);
      seen.add(tag);
    }

    expect(duplicates, 'Listed in more than one category').toEqual([]);
    expect(DOCUMENTED_TAGS).toHaveLength(TAG_NAMES.length);
  });

  it('gives every tag an example', () => {
    const missing = TAG_NAMES.filter((name) => !ELEMENT_DOCS[name]?.example);
    expect(missing, `No example in ELEMENT_DOCS: ${missing.join(', ')}`).toEqual([]);
  });

  it('gives every tag a parts entry, even an empty one', () => {
    const missing = TAG_NAMES.filter((name) => PARTS[name] === undefined);
    expect(missing, `No PARTS entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('declares parts and states only for tags that exist', () => {
    const stray = [...Object.keys(PARTS), ...Object.keys(STATES)].filter((name) => !(name in TAGS));
    expect(stray, `PARTS/STATES name a tag the contract does not have`).toEqual([]);
  });

  it('points `related` only at real tags', () => {
    const broken: string[] = [];
    for (const [tag, documentation] of Object.entries(ELEMENT_DOCS)) {
      for (const related of documentation.related ?? []) {
        if (related in TAGS) continue;
        broken.push(`${tag} → ${related}`);
      }
    }

    expect(broken).toEqual([]);
  });

  /**
   * An example that would fail `forgedoc validate` is worse than no example: an
   * agent copies it, the build rejects it, and the docs are the reason. Attribute
   * names are the part that goes stale when an attribute is renamed, so they are
   * what this checks.
   */
  it('uses only attributes the contract accepts in every example', () => {
    const GLOBAL = new Set(['id', 'class', 'style', 'hidden', 'lang', 'dir', 'slot']);
    const offenders: string[] = [];

    for (const tag of TAG_NAMES) {
      const example = ELEMENT_DOCS[tag]?.example ?? '';

      for (const match of example.matchAll(/<(doc-[a-z-]+)((?:\s+[^<>]*)?)>/g)) {
        const [, element, attributeText = ''] = match;
        if (!element || !(element in TAGS)) continue;

        const allowed = new Set([
          ...Object.keys((TAGS[element as TagName] as TagSpec).attributes),
          ...GLOBAL,
        ]);

        // Blank the quoted values first: `question="Should read state be…"`
        // otherwise offers up every word of the question as an attribute name.
        const bare = attributeText.replace(/=\s*(?:"[^"]*"|'[^']*')/g, '=');

        for (const attribute of bare.matchAll(/(?:^|\s)([a-z][a-z-]*)(?==|\s|$)/g)) {
          const name = attribute[1];
          if (!name || allowed.has(name)) continue;
          offenders.push(`<${element} ${name}> in the ${tag} example`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('forgedoc elements', () => {
  it('summarises every tag', () => {
    expect(elementSummaries()).toHaveLength(TAG_NAMES.length);
  });

  it('filters by category, case-insensitively', () => {
    const interactive = elementSummaries('INTERACTIVE');

    expect(interactive.length).toBeGreaterThan(0);
    expect(interactive.every((summary) => summary.category === 'Interactive')).toBe(true);
    expect(interactive.map((summary) => summary.tag)).toContain('doc-choice');
  });

  it('names the categories back when the filter matches nothing', () => {
    const output = renderElements('nonsense');

    expect(output).toContain('No category matches');
    for (const category of CATEGORIES) expect(output).toContain(category.title);
  });

  it('flags the constraints that decide whether markup is legal', () => {
    const output = renderElements();

    expect(output).toContain('generated — never write it');
    expect(output).toContain('only inside <doc-choice>');
    expect(output).toContain('needs <doc-option>');
  });
});

describe('forgedoc info', () => {
  it('resolves a bare name, a prefixed name and a tag in brackets alike', () => {
    for (const query of ['choice', 'doc-choice', '<doc-choice>', 'DOC-CHOICE ']) {
      expect(normaliseTag(query)).toBe('doc-choice');
    }
  });

  it('does not invent a tag for an unknown name', () => {
    // It echoes what was typed rather than guessing a prefix, so the error
    // message quotes the author back to themselves.
    expect(normaliseTag('sparkline')).toBe('sparkline');
    expect(normaliseTag('sparkline') in TAGS).toBe(false);
  });

  it('suggests the near-miss an author actually typed', () => {
    expect(suggestTags('doc-tabl')).toContain('doc-table');
    expect(suggestTags('doc-not')).toContain('doc-note');
  });

  it('carries the whole authoring surface for a tag', () => {
    const detail = elementDetail('doc-blocker');

    expect(detail.required).toEqual(['title']);
    expect(detail.requiresChild).toEqual(['doc-action']);
    expect(detail.parts).toContain('badge');
    expect(detail.example).toContain('doc-action');
  });

  it('renders every tag without throwing, and always with an example', () => {
    for (const tag of TAG_NAMES) {
      const output = renderInfo(tag);
      expect(output, tag).toContain(`# \`<${tag}>\``);
      expect(output, tag).toContain('```html');
    }
  });

  it('leads with the constraint, so a child-only tag cannot be misread', () => {
    expect(renderInfo('doc-option')).toContain('**Only valid inside** `<doc-choice>`');
    expect(renderInfo('doc-toc')).toContain('**Generated by the runtime.**');
    expect(renderInfo('doc-badge')).toContain('**Inline element**');
  });
});

describe('forgedoc search', () => {
  it('ranks an exact tag name first', () => {
    expect(searchDocs('endpoint')[0]?.tag).toBe('doc-endpoint');
  });

  it('finds a tag by what it does rather than by its name', () => {
    const tags = searchDocs('table of contents').map((hit) => hit.tag);
    expect(tags).toContain('doc-toc');

    const blockers = searchDocs('roadblock').map((hit) => hit.tag);
    expect(blockers).toContain('doc-blocker');
  });

  it('finds a tag by an enum value', () => {
    expect(searchDocs('mermaid').map((hit) => hit.tag)).toContain('doc-figure');
    expect(searchDocs('raci').map((hit) => hit.tag)).toContain('doc-matrix');
  });

  it('ignores single characters, which match everything', () => {
    expect(searchDocs('a')).toEqual([]);
  });

  it('says what to try next when nothing matches', () => {
    const output = renderSearch('kubernetes');
    expect(output).toContain('Nothing matches');
    expect(output).toContain('forgedoc elements');
  });

  it('reports which field matched, so a name hit reads differently from prose', () => {
    const [hit] = searchDocs('endpoint');
    expect(hit?.matched).toContain('name');
  });
});

describe('forgedoc reference', () => {
  const reference = renderReference();

  it('documents every tag, including the generated and child-only ones', () => {
    for (const tag of TAG_NAMES) {
      expect(reference, `<${tag}> is missing`).toContain(`### \`<${tag}>\``);
    }
  });

  it('documents every attribute of every tag', () => {
    const missing: string[] = [];

    for (const tag of TAG_NAMES) {
      for (const attribute of Object.keys((TAGS[tag] as TagSpec).attributes)) {
        if (reference.includes(`| \`${attribute}\``)) continue;
        missing.push(`${tag}.${attribute}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('carries the guidance that spans every tag', () => {
    expect(reference).toContain('## Global attributes');
    expect(reference).toContain('## The three override tiers');
    expect(reference).toContain('## ARIA');
    expect(reference).toContain('## Code language allowlist');
  });
});
