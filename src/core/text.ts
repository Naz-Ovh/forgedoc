/**
 * Reading preformatted author text out of the DOM.
 *
 * Shared by `plan-code`, `plan-diff` and `plan-tree` — three components whose
 * content is whitespace-significant text the agent wrote indented to match the
 * surrounding markup (§12: abstract at the third occurrence).
 */

/**
 * The element's text with the leading newline and trailing blank space removed,
 * and the common indentation stripped.
 *
 * why the dedent is not optional: the agent writes
 *
 * ```html
 *     <plan-code lang="ts">
 *       const x = 1;
 *     </plan-code>
 * ```
 *
 * so every line arrives with six leading spaces. For `plan-code` that is merely
 * ugly; for `plan-diff` it is a correctness bug, because `+` and `-` no longer
 * start the line and every row classifies as unchanged context.
 */
export function readBlockText(element: Element): string {
  const raw = (element.textContent ?? '').replace(/^\n/, '').replace(/\s+$/, '');
  return dedent(raw);
}

/** Strip the indentation common to every non-blank line. */
export function dedent(source: string): string {
  const lines = source.split('\n');
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);

  if (indents.length === 0) return source;

  const common = Math.min(...indents);
  if (common === 0) return source;
  return lines.map((line) => line.slice(common)).join('\n');
}
