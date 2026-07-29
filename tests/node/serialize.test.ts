/**
 * §13.2: round-trip an `FB v1` block through serialise → parse → serialise and
 * assert **byte** equality against a checked-in golden file.
 *
 * why byte equality rather than deep-equal on the parsed object: the wire format
 * is what a human pastes into a chat window and what an agent reads back. A
 * change that only reorders whitespace still breaks every receipt rule in
 * SKILL.md, and only a byte comparison catches it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type BucketDocument, parseBucket, serializeBucket } from '../../src/bucket/serialize.js';

const GOLDEN = readFileSync(
  fileURLToPath(new URL('../golden/bucket-v1.txt', import.meta.url)),
  'utf8',
);

describe('FB v1 wire format', () => {
  it('round-trips the golden file byte for byte', () => {
    const parsed = parseBucket(GOLDEN);

    expect(parsed.problems).toEqual([]);
    expect(parsed.document).not.toBeNull();
    expect(serializeBucket(parsed.document as BucketDocument)).toBe(GOLDEN);
  });

  it('reads the header fields', () => {
    const parsed = parseBucket(GOLDEN).document as BucketDocument;

    expect(parsed.planId).toBe('vendor-orders');
    expect(parsed.timestamp).toBe('2026-07-28T10:22:31Z');
    expect(parsed.entries).toHaveLength(4);
  });

  it('carries question text and option labels verbatim', () => {
    const [first] = parseBucket(GOLDEN).document?.entries ?? [];

    expect(first).toMatchObject({
      kind: 'answer',
      anchorId: 'q-when-one-team-member-reads-a-notification-should-it',
      question:
        'When one team member reads a notification, should it show as read for the whole vendor team?',
      labels: ['Yes — shared team inbox'],
    });
  });

  it('folds a multi-line note back together', () => {
    const [first] = parseBucket(GOLDEN).document?.entries ?? [];

    expect(first).toHaveProperty(
      'note',
      'only if we can still see who marked it read\notherwise nobody will trust it',
    );
  });

  it('keeps every selected label for a multi answer', () => {
    const entries = parseBucket(GOLDEN).document?.entries ?? [];
    expect(entries[1]).toMatchObject({
      labels: ['Offline single file', 'CDN script tag'],
    });
  });

  it('reads a comment with its quote and location', () => {
    const entries = parseBucket(GOLDEN).document?.entries ?? [];

    expect(entries[3]).toEqual({
      kind: 'comment',
      anchorId: 'sec-what-we-are-building',
      at: '1 What we are building',
      quote: 'Vendors get told the moment a new order lands',
      comment: 'is this the payment webhook or the order row landing in the table?',
    });
  });

  it('omits the note line when there is no note', () => {
    const text = serializeBucket({
      planId: 'p',
      timestamp: '2026-01-01T00:00:00Z',
      entries: [{ kind: 'answer', anchorId: 'q-x', question: 'X?', labels: ['A'] }],
    });

    expect(text).not.toContain('\nn: ');
    expect(text).toContain('1 item ===');
  });

  it('serialises an Other answer as the reader’s own text', () => {
    const text = serializeBucket({
      planId: 'p',
      timestamp: '2026-01-01T00:00:00Z',
      entries: [
        {
          kind: 'answer',
          anchorId: 'q-x',
          question: 'X?',
          labels: ['neither — split it into two endpoints'],
        },
      ],
    });

    expect(text).toContain('a: neither — split it into two endpoints');
  });

  it('survives a note whose own line begins with the continuation prefix', () => {
    const document: BucketDocument = {
      planId: 'p',
      timestamp: '2026-01-01T00:00:00Z',
      entries: [
        {
          kind: 'answer',
          anchorId: 'q-x',
          question: 'X?',
          labels: ['A'],
          note: 'first\n   already indented\nn: not a field',
        },
      ],
    };

    const once = serializeBucket(document);
    expect(serializeBucket(parseBucket(once).document as BucketDocument)).toBe(once);
    expect(parseBucket(once).document?.entries[0]).toHaveProperty(
      'note',
      'first\n   already indented\nn: not a field',
    );
  });

  it('rejects text with no header, and says why', () => {
    const parsed = parseBucket('just some prose the reader pasted by mistake');

    expect(parsed.document).toBeNull();
    expect(parsed.problems[0]?.reason).toContain('header');
  });

  it('a malformed item invalidates only itself', () => {
    const damaged = GOLDEN.replace(
      'q: Which delivery modes must ship in version one?\n',
      '',
    ).replace('a: Offline single file\na: CDN script tag\n', '');

    const parsed = parseBucket(damaged);

    expect(parsed.problems).toHaveLength(1);
    expect(parsed.document?.entries).toHaveLength(3);
  });
});
