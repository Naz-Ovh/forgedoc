/**
 * §5.3: placeholder replacement, and the `$&` trap that makes it non-obvious.
 */

import { describe, expect, it } from 'vitest';

import { InjectionError, injectAssets, usesMermaid } from '../../tools/inject.js';

const SOURCE = `<doc-page doc-id="x"></doc-page>
<style>/*@DOC_CSS@*/</style>
<script>//@DOC_JS@</script>`;

/** The canonical shape `forgedoc new` writes: styles in <head>, script last. */
const DOCUMENT = `<!doctype html>
<html lang="en">
<head>
<title>x</title>
<style>/*@DOC_CSS@*/</style>
</head>
<body>
<doc-page doc-id="x"></doc-page>
<script>//@DOC_JS@</script>
</body>
</html>`;

/**
 * The shape documents were authored in before the placeholder moved to <head>.
 * Those files are already committed in people's repositories, so the build has
 * to keep producing a correct document from them — which means hoisting.
 */
const LEGACY_DOCUMENT = `<!doctype html>
<html lang="en">
<head>
<title>x</title>
</head>
<body>
<doc-page doc-id="x"></doc-page>
<style>/*@DOC_CSS@*/</style>
<script>//@DOC_JS@</script>
</body>
</html>`;

const embed = (css: string, js: string) => ({ mode: 'embed', css, js }) as const;
const link = (cssHref: string, jsSrc: string) => ({ mode: 'link', cssHref, jsSrc }) as const;

describe('injectAssets', () => {
  it('replaces both placeholders', () => {
    const output = injectAssets(SOURCE, embed('doc-page{color:red}', 'console.log(1)'));

    expect(output).toContain('<style>doc-page{color:red}</style>');
    expect(output).toContain('<script>console.log(1)</script>');
    expect(output).not.toContain('@DOC_CSS@');
    expect(output).not.toContain('@DOC_JS@');
  });

  /*
   * Same reason as link mode: styles that land at the end of the body flash the
   * document unstyled first. Embedding removes the network hop, not the ordering
   * problem, so the embedded <style> is hoisted too.
   */
  it('keeps the embedded styles in <head> and the script last', () => {
    const output = injectAssets(DOCUMENT, embed('doc-page{color:red}', 'console.log(1)'));

    expect(output.indexOf('<style>doc-page{color:red}</style>')).toBeLessThan(
      output.indexOf('</head>'),
    );
    expect(output.indexOf('<script>console.log(1)</script>')).toBeGreaterThan(
      output.indexOf('<doc-page'),
    );
    // Lifted and re-emitted, not copied: exactly one stylesheet in the output.
    expect(output.split('<style>').length - 1).toBe(1);
  });

  it('hoists the styles out of a body-end placeholder written the old way', () => {
    const output = injectAssets(LEGACY_DOCUMENT, embed('doc-page{color:red}', 'console.log(1)'));

    expect(output.indexOf('<style>doc-page{color:red}</style>')).toBeLessThan(
      output.indexOf('</head>'),
    );
    expect(output.split('<style>').length - 1).toBe(1);
    expect(output).not.toContain('@DOC_CSS@');
  });

  it('does not treat $& in the embedded CSS as a replacement pattern', () => {
    const hostile = 'doc-page{--a:"$&";--b:"$1";--c:"$\'";--d:"$$"}';
    const output = injectAssets(DOCUMENT, embed(hostile, ''));

    expect(output).toContain(`<style>${hostile}</style>`);
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
    expect(() => injectAssets('<doc-page doc-id="x"></doc-page>', embed('', ''))).toThrow(
      InjectionError,
    );

    try {
      injectAssets('<doc-page doc-id="x"></doc-page>', embed('', ''));
    } catch (error) {
      expect((error as InjectionError).fix).toContain('<style>/*@DOC_CSS@*/</style>');
    }
  });

  describe('link mode', () => {
    it('swaps the placeholder tags for a stylesheet link and a deferred script', () => {
      const output = injectAssets(DOCUMENT, link('https://cdn/x.css', 'https://cdn/x.js'));

      expect(output).toContain('<link rel="stylesheet" href="https://cdn/x.css">');
      expect(output).toContain('<script src="https://cdn/x.js" defer></script>');
      expect(output).not.toContain('@DOC_CSS@');
      expect(output).not.toContain('@DOC_JS@');
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
      expect(() => injectAssets('<doc-page doc-id="x"></doc-page>', link('a', 'b'))).toThrow(
        InjectionError,
      );
    });
  });
});

describe('usesMermaid', () => {
  it('finds a Mermaid figure however the attributes are ordered', () => {
    expect(usesMermaid('<doc-figure type="mermaid">')).toBe(true);
    expect(usesMermaid('<doc-figure caption="x" type="mermaid">')).toBe(true);
    expect(usesMermaid("<doc-figure type='mermaid'>")).toBe(true);
    expect(usesMermaid('<doc-figure\n  type="mermaid"\n>')).toBe(true);
  });

  it('does not fire on other figure types or on the word alone', () => {
    expect(usesMermaid('<doc-figure type="svg">')).toBe(false);
    expect(usesMermaid('<p>We considered mermaid and rejected it.</p>')).toBe(false);
    expect(usesMermaid('<doc-figure type="mermaidish">')).toBe(false);
  });
});
