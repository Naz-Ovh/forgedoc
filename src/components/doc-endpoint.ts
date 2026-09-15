/**
 * `<doc-endpoint method="post" path="/api/orders" summary="Create an order">`
 *
 * A token-light API operation trigger. The authored element remains one compact
 * row; activating it sends its attributes to the single generated API drawer
 * owned by the surrounding `<doc-page>`.
 *
 * Parts: `trigger`, `method`, `path`, `summary`, `status`, `open-icon`, plus the
 * generated `endpoint-drawer*` parts documented below.
 */

import { DocElement } from '../core/base.js';
import { arrowRightIcon, closeIcon } from '../core/icons.js';
import { authorChildren, createPart, nameAuthorContent } from '../core/parts.js';

const ENDPOINT_OPEN_EVENT = 'forgedoc:endpoint-open';

type ParameterLocation = 'path' | 'query' | 'header' | 'body';

interface EndpointParameter {
  readonly name: string;
  readonly location: ParameterLocation;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
  readonly defaultValue: string;
}

interface EndpointDetails {
  readonly method: string;
  readonly path: string;
  readonly summary: string;
  readonly description: string;
  readonly auth: string;
  readonly headers: readonly string[];
  readonly status: string;
  readonly request: string;
  readonly response: string;
  readonly parameters: readonly EndpointParameter[];
}

interface EndpointOpenDetail {
  readonly endpoint: EndpointDetails;
  readonly trigger: HTMLButtonElement;
}

export interface EndpointDrawerHandle {
  destroy(): void;
}

export class DocEndpoint extends DocElement {
  protected enhance(): void {
    const endpoint = readEndpointDetails(this);

    this.internals.role = 'region';
    this.internals.ariaLabel = `${endpoint.method} ${endpoint.path}`;

    // MUST (§2.2): authored descriptions and nested parameter nodes stay exactly
    // where they were written. The screen presentation hides them and the drawer
    // renders attribute data; print can still reveal the original nodes.
    nameAuthorContent(this, 'body');

    const trigger = createTrigger(endpoint);
    this.on(trigger, 'click', () => {
      this.dispatchEvent(
        new CustomEvent<EndpointOpenDetail>(ENDPOINT_OPEN_EVENT, {
          bubbles: true,
          detail: { endpoint, trigger },
        }),
      );
    });
    this.prepend(trigger);
  }
}

/** Mount the one reusable API detail drawer generated for a document. */
export function mountEndpointDrawer(docPage: HTMLElement): EndpointDrawerHandle {
  const dialog = createPart('endpoint-drawer', 'dialog') as HTMLDialogElement;
  const listeners = new AbortController();
  let activeTrigger: HTMLButtonElement | null = null;

  // why (§2.2): the drawer is runtime chrome appended beside author content. It
  // never wraps or reparents an endpoint's authored nodes.
  docPage.append(dialog);

  docPage.addEventListener(
    ENDPOINT_OPEN_EVENT,
    (event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as EndpointOpenDetail | undefined;
      if (!detail?.endpoint || !(detail.trigger instanceof HTMLButtonElement)) return;

      activeTrigger = detail.trigger;
      renderDrawer(dialog, detail.endpoint);
      if (!dialog.open) dialog.showModal();
      dialog.querySelector<HTMLButtonElement>('[data-part="endpoint-drawer-close"]')?.focus();
    },
    { signal: listeners.signal },
  );

  dialog.addEventListener('close', () => queueMicrotask(() => activeTrigger?.focus()), {
    signal: listeners.signal,
  });
  dialog.addEventListener('click', (event) => closeFromBackdrop(dialog, event), {
    signal: listeners.signal,
  });

  return {
    destroy(): void {
      listeners.abort();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}

function createTrigger(endpoint: EndpointDetails): HTMLButtonElement {
  const trigger = createPart('trigger', 'button') as HTMLButtonElement;
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-label', `Open API details for ${endpoint.method} ${endpoint.path}`);

  const method = createPart('method', 'span', { text: endpoint.method });
  method.dataset.method = endpoint.method.toLowerCase();

  const path = createPart('path', 'code');
  appendFormattedPath(path, endpoint.path);

  const summary = createPart('summary', 'span', { text: endpoint.summary });
  const status = createPart('status', 'span', { text: endpoint.status });
  status.dataset.status = statusTone(endpoint.status);

  const openIcon = createPart('open-icon', 'span');
  openIcon.append(arrowRightIcon('open-arrow'));
  openIcon.setAttribute('aria-hidden', 'true');
  trigger.append(method, path, summary, status, openIcon);
  return trigger;
}

function readEndpointDetails(endpoint: HTMLElement): EndpointDetails {
  const path = attribute(endpoint, 'path', '/');
  const authoredDescription = readAuthoredDescription(endpoint);
  const parameters = mergeParameters([
    ...parseCompactParameters(attribute(endpoint, 'params')),
    ...readNestedParameters(endpoint),
    ...derivePathParameters(path),
  ]);

  return {
    method: attribute(endpoint, 'method', 'GET').toUpperCase(),
    path,
    summary: attribute(endpoint, 'summary', authoredDescription || 'API operation'),
    description: attribute(endpoint, 'description', authoredDescription),
    auth: attribute(endpoint, 'auth', 'none'),
    headers: splitList(attribute(endpoint, 'headers')),
    status: attribute(endpoint, 'status', 'Not documented'),
    request: attribute(endpoint, 'request'),
    response: attribute(endpoint, 'response'),
    parameters,
  };
}

function readAuthoredDescription(endpoint: HTMLElement): string {
  const paragraph = authorChildren(endpoint).find((child) => child.tagName === 'P');
  return normaliseText(paragraph?.textContent ?? '');
}

function parseCompactParameters(value: string): EndpointParameter[] {
  return splitList(value, ';').map((entry) => {
    const [name = '', rawLocation = 'query', type = 'string', requirement = '', ...description] =
      entry.split(':').map((part) => part.trim());
    const location = isParameterLocation(rawLocation) ? rawLocation : 'query';
    return {
      name,
      location,
      type,
      required: requirement === 'required' || location === 'path',
      description: description.join(':').trim(),
      defaultValue: '',
    };
  });
}

function readNestedParameters(endpoint: HTMLElement): EndpointParameter[] {
  return Array.from(endpoint.querySelectorAll<HTMLElement>('doc-param')).map((parameter) => ({
    name: attribute(parameter, 'name'),
    location: isParameterLocation(attribute(parameter, 'in'))
      ? (attribute(parameter, 'in') as ParameterLocation)
      : 'query',
    type: attribute(parameter, 'type', 'string'),
    required: parameter.hasAttribute('required'),
    description: normaliseText(
      authorChildren(parameter)
        .map((child) => child.textContent ?? '')
        .join(' '),
    ),
    defaultValue: attribute(parameter, 'default'),
  }));
}

function derivePathParameters(path: string): EndpointParameter[] {
  const names = Array.from(path.matchAll(/\{([a-zA-Z0-9_-]+)\}|:([a-zA-Z0-9_-]+)/g)).map(
    (match) => match[1] ?? match[2] ?? '',
  );
  return names.map((name) => ({
    name,
    location: 'path',
    type: 'string',
    required: true,
    description: '',
    defaultValue: '',
  }));
}

function mergeParameters(parameters: readonly EndpointParameter[]): EndpointParameter[] {
  const merged = new Map<string, EndpointParameter>();
  for (const parameter of parameters) {
    if (!parameter.name) continue;
    const key = `${parameter.location}:${parameter.name}`;
    if (!merged.has(key)) merged.set(key, parameter);
  }
  return Array.from(merged.values());
}

function renderDrawer(dialog: HTMLDialogElement, endpoint: EndpointDetails): void {
  const header = createDrawerHeader(dialog, endpoint);
  const content = createPart('endpoint-drawer-content', 'div');
  content.append(createOverview(endpoint), createMetadata(endpoint));

  if (endpoint.parameters.length > 0) content.append(createParameters(endpoint.parameters));
  if (endpoint.headers.length > 0) content.append(createHeaders(endpoint.headers));
  if (endpoint.request) content.append(createExample('Request example', endpoint.request));
  content.append(createResponse(endpoint));

  dialog.replaceChildren(header, content);
}

function createDrawerHeader(dialog: HTMLDialogElement, endpoint: EndpointDetails): HTMLElement {
  const header = createPart('endpoint-drawer-header', 'header');
  const eyebrow = createPart('endpoint-drawer-eyebrow', 'span', { text: 'API reference' });
  const close = createPart('endpoint-drawer-close', 'button') as HTMLButtonElement;
  close.append(closeIcon());
  close.type = 'button';
  close.setAttribute('aria-label', 'Close API details');
  close.addEventListener('click', () => dialog.close());

  const signature = createPart('endpoint-drawer-signature', 'div');
  const method = createPart('endpoint-drawer-method', 'span', { text: endpoint.method });
  method.dataset.method = endpoint.method.toLowerCase();
  const path = createPart('endpoint-drawer-path', 'code');
  appendFormattedPath(path, endpoint.path);
  const copy = createCopyButton(endpoint.path);
  signature.append(method, path, copy);
  header.append(eyebrow, close, signature);
  return header;
}

function createOverview(endpoint: EndpointDetails): HTMLElement {
  const section = createPart('endpoint-drawer-overview', 'section');
  const title = createPart('endpoint-drawer-title', 'h2', { text: endpoint.summary });
  section.append(title);
  if (endpoint.description) {
    section.append(createPart('endpoint-drawer-description', 'p', { text: endpoint.description }));
  }
  return section;
}

function createMetadata(endpoint: EndpointDetails): HTMLElement {
  const metadata = createPart('endpoint-drawer-metadata', 'dl');
  metadata.append(
    createMetadataItem('Authentication', endpoint.auth === 'none' ? 'None' : endpoint.auth),
    createMetadataItem('Response', endpoint.status),
  );
  return metadata;
}

function createMetadataItem(label: string, value: string): HTMLElement {
  const item = createPart('endpoint-drawer-meta-item', 'div');
  item.append(
    createPart('endpoint-drawer-meta-label', 'dt', { text: label }),
    createPart('endpoint-drawer-meta-value', 'dd', { text: value }),
  );
  return item;
}

function createParameters(parameters: readonly EndpointParameter[]): HTMLElement {
  const section = createSection('Parameters');
  const list = createPart('endpoint-drawer-parameters', 'div');
  for (const parameter of parameters) list.append(createParameter(parameter));
  section.append(list);
  return section;
}

function createParameter(parameter: EndpointParameter): HTMLElement {
  const row = createPart('endpoint-drawer-parameter', 'div');
  const name = createPart('endpoint-drawer-parameter-name', 'code', { text: parameter.name });
  const location = createPart('endpoint-drawer-parameter-in', 'span', { text: parameter.location });
  const type = createPart('endpoint-drawer-parameter-type', 'code', { text: parameter.type });
  const requirement = createPart('endpoint-drawer-parameter-required', 'span', {
    text: parameter.required ? 'required' : 'optional',
  });
  requirement.dataset.required = String(parameter.required);
  row.append(name, location, type, requirement);
  if (parameter.defaultValue) {
    row.append(
      createPart('endpoint-drawer-parameter-default', 'span', {
        text: `default: ${parameter.defaultValue}`,
      }),
    );
  }
  if (parameter.description) {
    row.append(
      createPart('endpoint-drawer-parameter-description', 'p', {
        text: parameter.description,
      }),
    );
  }
  return row;
}

function createHeaders(headers: readonly string[]): HTMLElement {
  const section = createSection('Request headers');
  const list = createPart('endpoint-drawer-headers', 'div');
  for (const header of headers) {
    list.append(createPart('endpoint-drawer-header-value', 'code', { text: header }));
  }
  section.append(list);
  return section;
}

function createResponse(endpoint: EndpointDetails): HTMLElement {
  const section = createSection('Responses');
  const status = createPart('endpoint-drawer-response-status', 'div');
  status.dataset.status = statusTone(endpoint.status);
  status.append(
    createPart('endpoint-drawer-response-code', 'code', {
      text: endpoint.status.split(/\s+/)[0] || endpoint.status,
    }),
    createPart('endpoint-drawer-response-label', 'span', {
      text: endpoint.status.split(/\s+/).slice(1).join(' ') || 'Response',
    }),
  );
  section.append(status);
  if (endpoint.response) section.append(createExampleCode(endpoint.response));
  return section;
}

function createExample(title: string, value: string): HTMLElement {
  const section = createSection(title);
  section.append(createExampleCode(value));
  return section;
}

function createExampleCode(value: string): HTMLElement {
  const pre = createPart('endpoint-drawer-example', 'pre');
  pre.append(createPart('endpoint-drawer-example-code', 'code', { text: value }));
  return pre;
}

function createSection(title: string): HTMLElement {
  const section = createPart('endpoint-drawer-section', 'section');
  section.append(createPart('endpoint-drawer-section-title', 'h3', { text: title }));
  return section;
}

function createCopyButton(path: string): HTMLButtonElement {
  const button = createPart('endpoint-drawer-copy', 'button', {
    text: 'Copy path',
  }) as HTMLButtonElement;
  button.type = 'button';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(path);
      button.textContent = 'Copied';
      setTimeout(() => (button.textContent = 'Copy path'), 1500);
    } catch {
      button.textContent = 'Copy unavailable';
    }
  });
  return button;
}

function appendFormattedPath(target: HTMLElement, path: string): void {
  const matcher = /(\{[a-zA-Z0-9_-]+\}|:[a-zA-Z0-9_-]+)/g;
  let cursor = 0;
  for (const match of path.matchAll(matcher)) {
    const index = match.index ?? 0;
    target.append(path.slice(cursor, index));
    target.append(createPart('path-param', 'mark', { text: match[0] }));
    cursor = index + match[0].length;
  }
  target.append(path.slice(cursor));
}

function closeFromBackdrop(dialog: HTMLDialogElement, event: MouseEvent): void {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!inside) dialog.close();
}

function statusTone(status: string): string {
  const code = Number.parseInt(status, 10);
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500) return '5xx';
  return 'neutral';
}

function isParameterLocation(value: string): value is ParameterLocation {
  return value === 'path' || value === 'query' || value === 'header' || value === 'body';
}

function splitList(value: string, separator: string | RegExp = /;|,/): string[] {
  return value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function attribute(element: Element, name: string, fallback = ''): string {
  return element.getAttribute(name)?.trim() || fallback;
}

function normaliseText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
