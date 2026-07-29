/**
 * §13.2: namespacing by `plan-id`; two documents in one origin do not collide;
 * the unavailable-storage path shows the banner and never throws.
 *
 * why the collision test matters more than it looks (§9.3): Chrome has
 * historically shared a single `localStorage` bucket across *all* `file://`
 * documents. Two plans opened from disk would otherwise see each other's
 * answers — and silent cross-contamination on a feedback tool is the worst
 * failure mode this library has.
 */

import { describe, expect, it, vi } from 'vitest';

import { createStore, probeStorage, storageKey } from '../../src/core/store.js';
import { emptyState } from '../../src/core/types.js';
import { mountPlan, settle } from '../helpers.js';

describe('storage namespacing', () => {
  it('keys everything under the plan id', () => {
    expect(storageKey('vendor-orders')).toBe('plankit:vendor-orders:state');
  });

  it('keeps two documents in the same origin apart', async () => {
    const first = createStore('plan-one');
    const second = createStore('plan-two');

    first.set('answers', { 'q-a': { keys: ['A'] } });
    second.set('answers', { 'q-a': { keys: ['B'] } });
    await settle();

    expect(first.get('answers')['q-a']?.keys).toEqual(['A']);
    expect(second.get('answers')['q-a']?.keys).toEqual(['B']);

    // And on the wire, not just in memory.
    expect(createStore('plan-one').get('answers')['q-a']?.keys).toEqual(['A']);
    expect(createStore('plan-two').get('answers')['q-a']?.keys).toEqual(['B']);
  });

  it('survives a reload cycle', async () => {
    const before = createStore('reloaded');
    before.set('answers', { 'q-x': { keys: ['B'], note: 'kept' } });
    await settle();

    const after = createStore('reloaded');
    expect(after.get('answers')['q-x']).toEqual({ keys: ['B'], note: 'kept' });
  });

  it('starts clean rather than throwing on corrupt JSON', () => {
    localStorage.setItem(storageKey('corrupt'), '{not json');
    expect(() => createStore('corrupt')).not.toThrow();
    expect(createStore('corrupt').get('answers')).toEqual({});
  });

  it('folds an older blob onto the current shape instead of discarding it', () => {
    localStorage.setItem(
      storageKey('legacy'),
      JSON.stringify({ version: 1, planId: 'legacy', answers: { 'q-x': { keys: ['A'] } } }),
    );

    const store = createStore('legacy');
    expect(store.get('answers')['q-x']?.keys).toEqual(['A']);
    expect(store.get('feedback')).toEqual([]);
    expect(store.get('tabs')).toEqual({});
  });
});

describe('unavailable storage', () => {
  /*
   * MUST (§9.3): detect with a real write/read/delete probe, not a `typeof`
   * check — the latter passes in Safari private mode and then throws on write.
   */
  it('is detected by writing, not by a typeof check', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(typeof localStorage).toBe('object');
    expect(probeStorage()).toBeNull();

    setItem.mockRestore();
    expect(probeStorage()).not.toBeNull();
  });

  it('never throws, and reports itself as unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const store = createStore('blocked');
    expect(store.available).toBe(false);
    expect(() => store.set('answers', { 'q-a': { keys: ['A'] } })).not.toThrow();
    expect(store.get('answers')['q-a']?.keys).toEqual(['A']);

    setItem.mockRestore();
  });

  it('shows a permanent banner in the document', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const planDoc = mountPlan(
      '<plan-section title="X"><p>a</p></plan-section>',
      'plan-id="banner"',
    );
    const banner = planDoc.querySelector('[data-part="storage-warning"]');

    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('won’t survive a reload');
    expect(banner?.getAttribute('role')).toBe('status');

    setItem.mockRestore();
  });

  it('shows no banner when storage works', () => {
    const planDoc = mountPlan('<plan-section title="X"><p>a</p></plan-section>', 'plan-id="fine"');
    expect(planDoc.querySelector('[data-part="storage-warning"]')).toBeNull();
  });
});

describe('store contract', () => {
  it('calls a new subscriber immediately, as Svelte requires', () => {
    const store = createStore('contract');
    const seen: number[] = [];

    const unsubscribe = store.subscribe((state) => seen.push(Object.keys(state.answers).length));
    expect(seen).toEqual([0]);

    store.set('answers', { 'q-a': { keys: ['A'] } });
    expect(seen).toEqual([0, 1]);

    unsubscribe();
    store.set('answers', {});
    expect(seen).toEqual([0, 1]);
  });

  it('clears back to an empty state', async () => {
    const store = createStore('cleared');
    store.set('answers', { 'q-a': { keys: ['A'] } });
    await settle();

    store.clear();
    expect(store.get('answers')).toEqual(emptyState('cleared').answers);
    expect(localStorage.getItem(storageKey('cleared'))).toBeNull();
  });
});
