/**
 * The contract is the single source of truth for the validator, the runtime's
 * registration list and every documentation command. This checks that it is
 * actually complete, which is the invariant `src/core/contract.ts` claims and
 * nothing previously verified.
 *
 * why it matters: `doc-table`, `doc-quote` and `doc-collapse` all shipped as
 * components, were registered by `defineAll()`, worked in a browser, and were
 * documented on the cheatsheet — while being absent from the contract, so
 * `forgedoc validate` rejected the very markup the docs told an agent to write.
 * A missing contract entry is invisible from every other direction.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TAG_NAMES, TAGS, type TagSpec } from '../../src/core/contract.js';

const COMPONENTS_DIR = fileURLToPath(new URL('../../src/components/', import.meta.url));
const INDEX = readFileSync(fileURLToPath(new URL('../../src/index.ts', import.meta.url)), 'utf8');

/** One file per tag, by convention: `src/components/doc-table.ts` ↔ `doc-table`. */
const componentFiles = (): string[] =>
  readdirSync(COMPONENTS_DIR)
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => entry.replace(/\.ts$/, ''))
    .sort();

/**
 * Tag names from the `ELEMENTS` map in `src/index.ts`.
 *
 * why read the source rather than import it: `src/index.ts` pulls in the browser
 * runtime, and a Node test MUST NOT (§11.2). The map is a plain object literal of
 * quoted keys, so scanning it is both sufficient and honest about what ships.
 */
const registeredTags = (): string[] => {
  const map = INDEX.slice(
    INDEX.indexOf('const ELEMENTS'),
    INDEX.indexOf('export function defineAll'),
  );
  return [...map.matchAll(/'(doc-[a-z-]+)':/g)].map((match) => match[1] as string).sort();
};

describe('the tag contract', () => {
  it('has an entry for every component that ships', () => {
    const missing = componentFiles().filter((name) => !(name in TAGS));

    expect(
      missing,
      `Components with no entry in src/core/contract.ts: ${missing.join(', ')}. ` +
        'The validator will reject them, so an agent cannot use them.',
    ).toEqual([]);
  });

  it('has a component for every entry', () => {
    const files = new Set(componentFiles());
    const orphans = TAG_NAMES.filter((name) => !files.has(name));

    expect(orphans, `Contract entries with no component: ${orphans.join(', ')}`).toEqual([]);
  });

  it('registers exactly the tags the contract declares', () => {
    expect(registeredTags()).toEqual([...TAG_NAMES].sort());
  });

  /**
   * A required attribute on a child-only tag is fine; a required attribute on a
   * tag the runtime generates is not, because nobody can supply it.
   */
  it('asks for no required attribute on a generated tag', () => {
    for (const name of TAG_NAMES) {
      const spec = TAGS[name] as TagSpec;
      if (!spec.generated) continue;

      const required = Object.entries(spec.attributes).filter(([, def]) => def.required);
      expect(required.map(([attribute]) => `${name}.${attribute}`)).toEqual([]);
    }
  });

  it('names only real tags in onlyInside and requiresChild', () => {
    const broken: string[] = [];

    for (const name of TAG_NAMES) {
      const spec = TAGS[name] as TagSpec;
      for (const parent of spec.onlyInside ?? []) {
        if (!(parent in TAGS)) broken.push(`${name}.onlyInside → ${parent}`);
      }
      for (const child of spec.requiresChild ?? []) {
        if (!(child in TAGS)) broken.push(`${name}.requiresChild → ${child}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it('declares no empty enum, which would accept nothing at all', () => {
    for (const name of TAG_NAMES) {
      for (const [attribute, definition] of Object.entries((TAGS[name] as TagSpec).attributes)) {
        if (definition.kind.type !== 'enum') continue;
        expect(definition.kind.values.length, `${name}.${attribute}`).toBeGreaterThan(0);
      }
    }
  });
});
