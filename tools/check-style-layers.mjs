/**
 * Keep the base/theme boundary honest.
 *
 * Two properties, both of which decay silently and neither of which any test
 * would catch — a document rendered with the wrong colour in `base/` looks
 * completely fine until someone writes the *second* theme, at which point one
 * component refuses to change and nobody knows why.
 *
 *   1. `base/` declares only structure. If a colour, a size, a spacing or a
 *      typography property appears there, that declaration is unthemeable: no
 *      `themes/<name>/` can move it without restating the whole selector.
 *
 *   2. Every theme declares the same token set. A theme missing a token is a
 *      component silently computing against `unset`, which in CSS means
 *      "inherit or initial" — usually black text on a black background, and
 *      only on the one component that happened to use it.
 *
 * The property partition lives in `style-properties.mjs`, so the rule this
 * enforces and the rule a contributor is told to follow are the same list.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { classify } from './style-properties.mjs';

const BASE = 'src/styles/base';
const THEMES = 'src/styles/themes';
/** The theme every other theme is checked against. */
const REFERENCE = 'forgedoc';

function scssFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...scssFiles(path));
    else if (entry.endsWith('.scss')) found.push(path);
  }
  return found;
}

/** Declarations in a file, as `{ line, property }`. */
function declarations(source) {
  const found = [];
  source.split('\n').forEach((text, index) => {
    const match = /^\s+(--[\w-]+|-?[a-z-]+)\s*:\s*[^{};]+;/.exec(text);
    if (match) found.push({ line: index + 1, property: match[1] });
  });
  return found;
}

const problems = [];

// ── 1. base/ is headless ────────────────────────────────────────────────────
for (const file of scssFiles(BASE)) {
  const source = readFileSync(file, 'utf8');

  for (const { line, property } of declarations(source)) {
    if (classify(property) === 'theme') {
      problems.push(
        `${relative('.', file)}:${line}  '${property}' is a theme property — ` +
          `move it to ${THEMES}/<name>/, or a theme can never change it`,
      );
    }
  }

  for (const [index, text] of source.split('\n').entries()) {
    const literal = /(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch?\(|\bhsla?\()/.exec(text);
    if (literal && !text.trimStart().startsWith('*') && !text.trimStart().startsWith('/*')) {
      problems.push(
        `${relative('.', file)}:${index + 1}  colour literal '${literal[1]}' in base/ — ` +
          `every colour belongs to a theme`,
      );
    }
  }
}

// ── 2. every theme declares the same tokens ─────────────────────────────────
function tokensOf(theme) {
  const names = new Set();
  for (const file of scssFiles(join(THEMES, theme))) {
    for (const { property } of declarations(readFileSync(file, 'utf8'))) {
      if (property.startsWith('--')) names.add(property);
    }
  }
  return names;
}

const themes = readdirSync(THEMES).filter((entry) =>
  statSync(join(THEMES, entry)).isDirectory(),
);

if (!themes.includes(REFERENCE)) {
  problems.push(`the reference theme '${REFERENCE}' is missing from ${THEMES}/`);
} else {
  const reference = tokensOf(REFERENCE);
  for (const theme of themes.filter((name) => name !== REFERENCE)) {
    const missing = [...reference].filter((token) => !tokensOf(theme).has(token));
    for (const token of missing.sort()) {
      problems.push(
        `${THEMES}/${theme}  does not declare '${token}' — ` +
          `every component that reads it will compute against unset`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('check-style-layers: the base/theme boundary has drifted\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}

console.log(
  `check-style-layers: clean — base/ is headless, ${themes.length} theme(s) share one token set`,
);
