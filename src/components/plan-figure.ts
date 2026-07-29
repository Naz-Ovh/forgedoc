/**
 * `<plan-figure type="mermaid" caption="…">` — one framed box for a diagram, an
 * image, Mermaid source, or an isolated HTML mock.
 *
 * Merged from what would otherwise be three tags (§8.6). One box, one caption
 * treatment, one width behaviour — three tags for what is visually the same
 * frame is vocabulary the agent has to memorise for no benefit.
 */

import { PlanElement } from '../core/base.js';
import { appendFeedbackButton } from '../core/feedback.js';
import { createPart, nameAuthorContent } from '../core/parts.js';
import { renderMermaid } from '../vendor/mermaid.js';

type FigureType = 'svg' | 'image' | 'mermaid' | 'html';

export class PlanFigure extends PlanElement {
  protected enhance(): void {
    const type = this.#type();
    this.internals.role = 'figure';
    this.dataset.figureType = type;

    this.#renderContent(type);
    this.#appendCaption();

    // The one place block feedback matters most: an image, an SVG or a rendered
    // diagram contains no text, so this button is the only way to say anything
    // about it at all.
    appendFeedbackButton(this, this.attr('caption') || this.attr('alt') || type);
  }

  #type(): FigureType {
    const attribute = this.attr('type', 'svg');
    const known: readonly string[] = ['svg', 'image', 'mermaid', 'html'];
    return known.includes(attribute) ? (attribute as FigureType) : 'svg';
  }

  #renderContent(type: FigureType): void {
    switch (type) {
      case 'image':
        this.#renderImage();
        return;
      case 'mermaid':
        void this.#renderMermaidDiagram();
        return;
      case 'html':
        this.#renderIsolatedHtml();
        return;
      case 'svg':
        nameAuthorContent(this, 'content');
        return;
    }
  }

  #renderImage(): void {
    const src = this.attr('src');
    if (!src) return;
    if (this.findPart('content')) return;

    const image = createPart('content', 'img') as HTMLImageElement;
    image.src = src;
    image.alt = this.attr('alt', this.attr('caption'));
    image.loading = 'lazy';
    this.prepend(image);
  }

  /**
   * The single biggest token saving in the library (§8.6): five lines of Mermaid
   * replaces a few hundred lines of hand-placed SVG, and the model is far more
   * reliable writing it.
   */
  async #renderMermaidDiagram(): Promise<void> {
    const source = (this.textContent ?? '').trim();
    if (!source) return;

    const host = createPart('content', 'div');
    this.#removeRawSource();
    this.prepend(host);

    try {
      host.innerHTML = await renderMermaid(source);
    } catch (error) {
      host.append(this.#renderDiagramFailure(source, error));
    }
  }

  /** A visible, explanatory failure beats an empty box the reader cannot debug. */
  #renderDiagramFailure(source: string, error: unknown): HTMLElement {
    const failure = createPart('diagram-error', 'div');
    failure.append(
      createPart('diagram-error-title', 'div', { text: 'Diagram could not be rendered' }),
      createPart('diagram-error-detail', 'div', {
        text: error instanceof Error ? error.message : String(error),
      }),
      createPart('diagram-error-source', 'pre', { text: source }),
    );
    return failure;
  }

  /**
   * MUST (§8.6): `type="html"` renders inside `<iframe srcdoc>`, not inline.
   *
   * why: this is arbitrary markup with its own styles and possibly its own
   * scripts — a UI wireframe pasted from somewhere else. It is the one place in
   * this library where isolation genuinely matters. Shadow DOM would not have
   * helped, since it does not isolate JS.
   */
  #renderIsolatedHtml(): void {
    if (this.findPart('content')) return;

    const source = this.innerHTML;
    const frame = createPart('content', 'iframe') as HTMLIFrameElement;
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('title', this.attr('caption', 'Embedded preview'));
    frame.srcdoc = wrapForIframe(source);

    this.#removeRawSource();
    this.prepend(frame);
    frame.addEventListener('load', () => fitFrameToContent(frame));
  }

  #appendCaption(): void {
    const authored = this.querySelector<HTMLElement>(':scope > plan-caption');
    if (authored) {
      authored.dataset.part = 'caption';
      return;
    }

    const caption = this.attr('caption');
    if (!caption) return;
    if (this.findPart('caption')) return;
    this.append(createPart('caption', 'figcaption', { text: caption }));
  }

  #removeRawSource(): void {
    for (const node of Array.from(this.childNodes)) {
      const isChrome = node instanceof HTMLElement && node.dataset.planChrome !== undefined;
      const isCaption =
        node instanceof HTMLElement && node.tagName.toLowerCase() === 'plan-caption';
      if (isChrome || isCaption) continue;
      node.remove();
    }
  }
}

/** Give the embedded document the document's own type tokens, nothing more. */
function wrapForIframe(source: string): string {
  return `<!doctype html><meta charset="utf-8"><style>
    :root { color-scheme: light dark; }
    body { margin: 0; font: 14px/1.6 system-ui, sans-serif; }
  </style>${source}`;
}

/** Size the frame to its content once, so the box has no arbitrary height. */
function fitFrameToContent(frame: HTMLIFrameElement): void {
  try {
    const height = frame.contentDocument?.documentElement.scrollHeight;
    if (height) frame.style.height = `${height}px`;
  } catch {
    // Cross-origin or sandbox-blocked. The CSS default height still applies.
  }
}
