/**
 * Keep a `doc-custom` block's own CSS inside that block.
 *
 * The author writes ordinary CSS in a `<style>` inside `<doc-custom>`. Left
 * alone, a `<style>` in the body applies to the whole page, so `.bar { … }` in
 * one block would restyle every `.bar` in the document. Wrapped in a
 * prelude-less `@scope`, the browser scopes it to the `<style>` element's
 * parent — the block — natively, with no shadow root (§2.1) and no rewritten
 * selectors.
 *
 * `to ([data-doc-chrome])` is the scope's lower boundary: the runtime's own
 * chrome inside the block (its comment button) stays out of reach, so a
 * blanket `button { … }` in the block cannot restyle it.
 *
 * Shared by the build, which wraps the CSS in the file so it is scoped before
 * any script runs, and by the runtime, which wraps anything that was never
 * built — the dev server, or a page assembled by other tooling.
 */

/** The wrapper. Idempotence is checked by looking for a top-level `@scope`. */
export const SCOPE_OPEN = '@scope to ([data-doc-chrome]) {';

/**
 * At-rules that are global by nature and not allowed inside `@scope`, so they
 * are lifted above the wrapper instead of silently dropped.
 */
const GLOBAL_AT_RULE =
  /^@(?:keyframes|-webkit-keyframes|font-face|property|import|charset|namespace)\b/i;

/**
 * `css` with every rule inside a scope.
 *
 * Idempotent, because the build rewrites the document in place and reads its
 * own output next time: statements already inside an `@scope` stay as they
 * are, and only rules left outside one — say, a rule an agent appended on a
 * later revision — are wrapped. Already-scoped CSS comes back byte for byte.
 */
export function scopeCss(css: string): string {
  const statements = topLevelStatements(css);
  const kindOf = (statement: string): 'scope' | 'global' | 'rule' => {
    const head = headOf(statement);
    if (/^@scope\b/i.test(head)) return 'scope';
    return GLOBAL_AT_RULE.test(head) ? 'global' : 'rule';
  };

  const rules = statements.filter((statement) => kindOf(statement) === 'rule');
  if (rules.length === 0) return css;

  const kept = statements.filter((statement) => kindOf(statement) !== 'rule');
  const lead = kept.length > 0 ? `${kept.join('\n')}\n` : '';
  return `\n${lead}${SCOPE_OPEN}\n${rules.join('\n')}\n}\n`;
}

/**
 * Split a stylesheet into its top-level statements: rules and at-rules,
 * trimmed, comments kept with the statement they precede.
 *
 * Tracks strings, comments and brace depth only — enough to find where one
 * statement ends without a CSS parser in the bundle.
 */
export function topLevelStatements(css: string): string[] {
  const statements: string[] = [];
  let depth = 0;
  let start = 0;
  let index = 0;

  while (index < css.length) {
    const char = css[index];
    if (char === '/' && css[index + 1] === '*') {
      const close = css.indexOf('*/', index + 2);
      index = close === -1 ? css.length : close + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      index = endOfString(css, index);
      continue;
    }
    if (char === '{') depth++;
    if (char === '}') depth = Math.max(0, depth - 1);
    const ends = depth === 0 && (char === '}' || char === ';');
    index++;
    if (ends) {
      pushStatement(statements, css.slice(start, index));
      start = index;
    }
  }
  pushStatement(statements, css.slice(start));
  return statements;
}

function pushStatement(statements: string[], text: string): void {
  const statement = text.trim();
  if (statement !== '') statements.push(statement);
}

/** A statement with its leading comments removed, for telling what kind it is. */
function headOf(statement: string): string {
  return statement.replace(LEADING_COMMENTS, '');
}

const LEADING_COMMENTS = /^(?:\s*\/\*[\s\S]*?\*\/)*\s*/;

function endOfString(css: string, open: number): number {
  const quote = css[open];
  let index = open + 1;
  while (index < css.length && css[index] !== quote) {
    index += css[index] === '\\' ? 2 : 1;
  }
  return index + 1;
}
