/**
 * `doc-custom` styles stay inside their block: `scopeCss` wraps a block's CSS in
 * a prelude-less `@scope`, and the build applies it to every `<style>` inside a
 * `<doc-custom>`. Both have to be idempotent, because the build rewrites the
 * document in place and reads its own output on the next revision.
 */

import { describe, expect, it } from 'vitest';

import { SCOPE_OPEN, scopeCss, topLevelStatements } from '../../src/core/scope-css.js';
import { scopeCustomStyles } from '../../tools/inject.js';

describe('scopeCss', () => {
  it('wraps plain rules in a scope bounded above the runtime chrome', () => {
    const scoped = scopeCss('.bar { color: red; }');
    expect(scoped).toContain(SCOPE_OPEN);
    expect(scoped).toContain('.bar { color: red; }');
    expect(scoped.trim().endsWith('}')).toBe(true);
  });

  it('returns already-scoped CSS byte for byte', () => {
    const once = scopeCss('.bar { color: red; } .baz { margin: 0 }');
    expect(scopeCss(once)).toBe(once);
  });

  it('wraps a rule appended outside the scope on a later revision', () => {
    const revised = `${scopeCss('.bar { color: red; }')}\n.late { color: blue; }`;
    const statements = topLevelStatements(scopeCss(revised));
    expect(statements.every((statement) => statement.startsWith('@scope'))).toBe(true);
    expect(statements).toHaveLength(2);
  });

  it('lifts keyframes and font faces out, since @scope cannot hold them', () => {
    const scoped = scopeCss(
      '@keyframes spin { to { rotate: 1turn; } } .bar { animation: spin 1s; }',
    );
    const statements = topLevelStatements(scoped);
    expect(statements[0]).toMatch(/^@keyframes spin/);
    expect(statements[1]).toMatch(/^@scope/);
  });

  it('is not fooled by braces in strings or comments', () => {
    const statements = topLevelStatements('/* { */ .a { content: "}"; } .b { color: red }');
    expect(statements).toHaveLength(2);
  });

  it('leaves empty CSS alone', () => {
    expect(scopeCss('  \n ')).toBe('  \n ');
  });
});

describe('scopeCustomStyles', () => {
  const DOCUMENT = `<style>body { margin: 0 }</style>
<doc-custom title="x"><style>.jar { gap: 4px }</style><div class="jar"></div></doc-custom>`;

  it('scopes styles inside a custom block and nothing else', () => {
    const built = scopeCustomStyles(DOCUMENT);
    expect(built).toContain('<style>body { margin: 0 }</style>');
    expect(built).toMatch(/<doc-custom title="x"><style>\s*@scope to/);
  });

  it('changes nothing on a second build', () => {
    const once = scopeCustomStyles(DOCUMENT);
    expect(scopeCustomStyles(once)).toBe(once);
  });
});
