/**
 * §5.3: placeholder replacement, and the `$&` trap that makes it non-obvious.
 */

import { describe, expect, it } from 'vitest';

import { InjectionError, injectAssets, usesMermaid } from '../../tools/inject.js';

const SOURCE = `<plan-doc plan-id="x"></plan-doc>
<style>/*@PLAN_CSS@*/</style>
<script>//@PLAN_JS@</script>`;

const DOCUMENT = `<!doctype html>
<html lang="en">
<head>
<title>x</title>
</head>
<body>
<plan-doc plan-id="x"></plan-doc>
<style>/*@PLAN_CSS@*/</style>
<script>//@PLAN_JS@</script>
</body>
</html>`;

const embed = (css: string, js: string) => ({ mode: 'embed', css, js }) as const;
const link = (cssHref: string, jsSrc: string) => ({ mode: 'link', cssHref, jsSrc }) as const;

describe('injectAssets', () => {
  it('replaces both placeholders', () => {
    const output = injectAssets(SOURCE, embed('plan-doc{color:red}', 'console.log(1)'));

    expect(output).toContain('<style>plan-doc{color:red}</style>');
    expect(output).toContain('<script>console.log(1)</script>');
    expect(output).not.toContain('@PLAN_CSS@');
    expect(output).not.toContain('@PLAN_JS@');
  });

  /*
   * MUST (§5.3): the replacement is a function, not a string.
   *
   * A minifier emits `$` freely — `$&`, `$1`, `$'` all appear in real bundles.
   * Passed as a string, `String.prototype.replace` would interpret them as
   * replacement patterns and splice parts of the *document* into the bundle,
   * producing a file that loads and then fails in a way nobody can trace back.
   */
  it('does not treat $& or $1 in the bundle as replacement patterns', () => {
    const hostile = 'const a="$&";const b="$1";const c="$\'";const d="$$";';
    const output = injectAssets(SOURCE, embed('', hostile));

    expect(output).toContain(`<script>${hostile}</script>`);
  });

  it('explains what to add when a placeholder is missing', () => {
    expect(() => injectAssets('<plan-doc plan-id="x"></plan-doc>', embed('', ''))).toThrow(
      InjectionError,
    );

    try {
      injectAssets('<plan-doc plan-id="x"></plan-doc>', embed('', ''));
    } catch (error) {
      expect((error as InjectionError).fix).toContain('<style>/*@PLAN_CSS@*/</style>');
    }
  });

  describe('link mode', () => {
    it('swaps the placeholder tags for a stylesheet link and a deferred script', () => {
      const output = injectAssets(DOCUMENT, link('https://cdn/x.css', 'https://cdn/x.js'));

      expect(output).toContain('<link rel="stylesheet" href="https://cdn/x.css">');
      expect(output).toContain('<script src="https://cdn/x.js" defer></script>');
      expect(output).not.toContain('@PLAN_CSS@');
      expect(output).not.toContain('@PLAN_JS@');
      // The empty <style> shell must go too, not just its contents.
      expect(output).not.toContain('<style>');
    });

    /*
     * `<link rel="stylesheet">` in <body> renders everywhere but is not
     * conforming HTML, and a body-end stylesheet flashes unstyled markup at the
     * reader before it lands.
     */
    it('puts the stylesheet in <head>, not where the placeholder was', () => {
      const output = injectAssets(DOCUMENT, link('https://cdn/x.css', 'https://cdn/x.js'));
      const head = output.indexOf('</head>');
      const link1 = output.indexOf('<link rel="stylesheet"');

      expect(link1).toBeGreaterThan(-1);
      expect(link1).toBeLessThan(head);
    });

    it('falls back to <body> when the document has no head', () => {
      const output = injectAssets(SOURCE, link('https://cdn/x.css', 'https://cdn/x.js'));
      expect(output).toContain('<link rel="stylesheet" href="https://cdn/x.css">');
    });

    it('still refuses a document with no placeholders', () => {
      expect(() => injectAssets('<plan-doc plan-id="x"></plan-doc>', link('a', 'b'))).toThrow(
        InjectionError,
      );
    });
  });
});

describe('usesMermaid', () => {
  it('finds a Mermaid figure however the attributes are ordered', () => {
    expect(usesMermaid('<plan-figure type="mermaid">')).toBe(true);
    expect(usesMermaid('<plan-figure caption="x" type="mermaid">')).toBe(true);
    expect(usesMermaid("<plan-figure type='mermaid'>")).toBe(true);
    expect(usesMermaid('<plan-figure\n  type="mermaid"\n>')).toBe(true);
  });

  it('does not fire on other figure types or on the word alone', () => {
    expect(usesMermaid('<plan-figure type="svg">')).toBe(false);
    expect(usesMermaid('<p>We considered mermaid and rejected it.</p>')).toBe(false);
    expect(usesMermaid('<plan-figure type="mermaidish">')).toBe(false);
  });
});
