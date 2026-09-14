import { describe, expect, it } from 'vitest';

import { mountPlan, waitFor } from '../helpers.js';

describe('doc-figure type="html"', () => {
  it('renders escaped author markup as HTML inside its isolated frame', async () => {
    const page = mountPlan(`<doc-figure type="html" caption="Isolated mock">
      &lt;div data-preview="box" style="padding:12px"&gt;Isolated markup&lt;/div&gt;
    </doc-figure>`);
    const frame = page.querySelector('iframe[data-part="content"]') as HTMLIFrameElement;

    expect(frame.srcdoc).toContain('<div data-preview="box" style="padding:12px">');
    expect(frame.srcdoc).not.toContain('&lt;div');

    // The frame parses `srcdoc` on its own schedule, so wait for the node to
    // exist rather than for a duration.
    const box = await waitFor(() => frame.contentDocument?.querySelector('[data-preview="box"]'));
    expect(box.textContent).toBe('Isolated markup');
  });

  it('does not copy an authored rich caption into the isolated document', () => {
    const page = mountPlan(`<doc-figure type="html">
      &lt;strong&gt;Preview&lt;/strong&gt;
      <doc-caption>Caption with <code>markup</code>.</doc-caption>
    </doc-figure>`);
    const frame = page.querySelector('iframe[data-part="content"]') as HTMLIFrameElement;

    expect(frame.srcdoc).toContain('<strong>Preview</strong>');
    expect(frame.srcdoc).not.toContain('Caption with');
  });
});
