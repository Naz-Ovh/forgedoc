/**
 * Browser-mode test setup.
 *
 * Importing the entry point once here defines the whole vocabulary for every
 * test file, which also mirrors how a real document loads it: definitions land
 * after the markup exists, so every element upgrades once with all of its
 * children present (§5.2).
 */

import { afterEach, beforeEach } from 'vitest';

import '../src/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  for (const planDoc of Array.from(document.querySelectorAll('plan-doc'))) {
    planDoc.remove();
  }
  localStorage.clear();
});
