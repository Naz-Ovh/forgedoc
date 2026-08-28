// @ts-check
/**
 * Style layer validation tool.
 *
 * Ensures:
 * 1. Base components in `src/styles/base/components/` contain no forbidden theme tokens
 *    or hardcoded colors/visual presentation properties that should be theme-controlled.
 * 2. Every theme in `src/styles/themes/<name>/` implements the required token set.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baseComponentsDir = join(root, 'src', 'styles', 'base', 'components');
const themesDir = join(root, 'src', 'styles', 'themes');

/** Visual properties that are forbidden in headless base styles. */
const FORBIDDEN_IN_BASE = [
  /color:\s*#/i,
  /background(?:-color)?:\s*#/i,
  /border(?:-color)?:\s*#/i,
  /box-shadow:\s*[^;]*#/i,
];

let errors = 0;

// Check base component SCSS files
const baseFiles = readdirSync(baseComponentsDir).filter((file) => file.endsWith('.scss'));
for (const file of baseFiles) {
  const content = readFileSync(join(baseComponentsDir, file), 'utf8');
  for (const pattern of FORBIDDEN_IN_BASE) {
    if (pattern.test(content)) {
      process.stderr.write(
        `Error: Base component style '${file}' contains hardcoded visual color/theme property matching ${pattern}.\n`,
      );
      errors++;
    }
  }
}

// Extract tokens declared in forgedoc reference theme
const forgedocTokensPath = join(themesDir, 'forgedoc', '_tokens.scss');
const referenceTokensContent = readFileSync(forgedocTokensPath, 'utf8');
const tokenMatches = referenceTokensContent.matchAll(/--doc-[a-zA-Z0-9-]+(?=:)/g);
const requiredTokens = new Set([...tokenMatches].map((m) => m[0]));

// Check other themes define the token set
const themes = readdirSync(themesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const theme of themes) {
  const tokensPath = join(themesDir, theme, '_tokens.scss');
  const content = readFileSync(tokensPath, 'utf8');
  for (const token of requiredTokens) {
    if (!content.includes(token)) {
      process.stderr.write(`Error: Theme '${theme}' is missing required token '${token}'.\n`);
      errors++;
    }
  }
}

if (errors > 0) {
  process.stderr.write(`check-style-layers: failed with ${errors} error(s).\n`);
  process.exit(1);
}

process.stdout.write(
  `check-style-layers: clean — base/ is headless, ${themes.length} theme(s) share one token set\n`,
);
