/**
 * Open a file path from the document in the reader's editor.
 *
 * The author writes a short, relative path (`apps/server/src/app.ts`) and,
 * once, where the project lives: `<doc-page files-root="/abs/root">`, or a root
 * relative to the plan file itself (`files-root="../.."`). The runtime turns
 * that into an editor URL. Which editor is the *reader's* choice, picked once
 * and remembered in this browser; the author's `files-editor` is only the
 * default until they pick.
 *
 * URL formats, each checked against the editor's source or a widely used
 * registry (Rails `ActiveSupport::Editor`, Laravel, Warp) rather than guessed:
 *
 *   · VS Code `vscode://file/<abs>:<line>:<col>` — documented. For a WSL path
 *     `vscode://vscode-remote/wsl+<distro>/<abs>:<line>:<col>`; VS Code's own
 *     URL handler (`app.ts`, `getWindowOpenableFromProtocolUrl`) opens a remote
 *     path with no `:line` as a *folder*, so a line is always written.
 *   · VS Code Insiders, Cursor, Windsurf — VS Code builds with their own scheme
 *     (`vscode-insiders://`, `cursor://`, `windsurf://`) and the same handler.
 *   · Zed `zed://file<abs>:<line>:<col>` — `open_listener.rs` strips
 *     `zed://file` and parses the rest as a path with a position. A URL cannot
 *     ask for a WSL remote: the distro only arrives through the `--wsl` CLI
 *     flag, and the Windows installer registers `zed://` as `Zed.exe "%1"`
 *     (`zed.iss`). So for a WSL project the default `zed` choice sends the
 *     Windows share path instead — `zed://file//wsl.localhost/<distro>/<abs>`
 *     — which Rust parses as a UNC path (its prefix parser maps `/` to `\`)
 *     and Zed for Windows opens as a file on that share. `zed-linux` keeps the
 *     plain Linux path, for Zed running inside WSL itself.
 *   · JetBrains `idea://open?file=<abs>&line=<line>` — registered by the IDE on
 *     macOS; not reliably on Windows or Linux.
 */

import { editorIcon } from './editor-icons.js';
import { createPart } from './parts.js';
import { probeStorage } from './store.js';

/** The editors a reader can pick, in picker order. `none` copies the path instead. */
export const EDITOR_IDS = [
  'vscode',
  'vscode-insiders',
  'cursor',
  'windsurf',
  'zed',
  'zed-linux',
  'idea',
  'none',
] as const;

export type EditorId = (typeof EDITOR_IDS)[number];

export const EDITOR_LABELS: Readonly<Record<EditorId, string>> = {
  vscode: 'VS Code',
  'vscode-insiders': 'VS Code Insiders',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  zed: 'Zed',
  'zed-linux': 'Zed inside WSL / Linux',
  idea: 'JetBrains IDE',
  none: 'Copy the path instead',
};

/** Where a path points: an absolute path, and the WSL distro it lives in, if any. */
export interface FileTarget {
  readonly path: string;
  readonly wsl: string | null;
  readonly line: number | null;
}

/** Fired on `document` when the reader picks another editor, so every chip updates. */
export const EDITOR_CHANGE_EVENT = 'doc-editor-change';

/** The `localStorage` key for the reader's editor. One per browser, not per document. */
const EDITOR_KEY = 'forgedoc:editor';

/** The editor URL for `target`, or null for `none`. */
export function editorUrl(editor: EditorId, target: FileTarget): string | null {
  const line = target.line ?? 1;
  const encoded = encodeURI(target.path);
  if (editor === 'none') return null;
  if (editor === 'idea') {
    return `idea://open?file=${encodeURIComponent(target.path)}&line=${line}`;
  }
  if (editor === 'zed-linux') return `zed://file${slashed(encoded)}:${line}`;
  if (editor === 'zed') {
    const share = target.wsl ? `//wsl.localhost/${encodeURIComponent(target.wsl)}` : '';
    return `zed://file${share}${slashed(encoded)}:${line}`;
  }

  const scheme = editor;
  if (target.wsl) {
    return `${scheme}://vscode-remote/wsl+${encodeURIComponent(target.wsl)}${slashed(encoded)}:${line}:1`;
  }
  return `${scheme}://file${slashed(encoded)}:${line}:1`;
}

function slashed(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Where `relative` points, given the document's `files-root` settings, or null
 * when no root is set (or a relative root cannot be resolved here).
 */
export function resolveTarget(
  docPage: Element | null,
  relative: string,
  line: number | null,
  location: { protocol: string; host: string; pathname: string } = globalThis.location,
): FileTarget | null {
  const root = docPage?.getAttribute('files-root')?.trim();
  if (!root) return null;

  const fromUrl = documentLocation(location);
  const wsl = docPage?.getAttribute('files-wsl')?.trim() || fromUrl?.wsl || null;
  const base = isAbsolute(root) ? root : fromUrl ? joinPath(fromUrl.directory, root) : null;
  if (!base) return null;

  const path = isAbsolute(relative) ? relative : joinPath(base, relative);
  return { path: normalisePath(path), wsl, line };
}

/**
 * The folder this document was opened from, as a filesystem path.
 *
 * `file://wsl.localhost/<distro>/home/me/plan.html` — Windows opening a file
 * inside WSL — yields the Linux path and the distro, which is how a plan kept
 * inside its own repository can say `files-root=".."` and still open files in
 * the right WSL distro.
 */
export function documentLocation(location: {
  protocol: string;
  host: string;
  pathname: string;
}): { directory: string; wsl: string | null } | null {
  if (location.protocol !== 'file:') return null;
  const pathname = decodeURIComponent(location.pathname);
  const directory = pathname.slice(0, pathname.lastIndexOf('/') + 1) || '/';
  const host = location.host.toLowerCase();

  if (host === 'wsl.localhost' || host === 'wsl$') {
    const [, distro = '', ...rest] = directory.split('/');
    return { directory: `/${rest.join('/')}`, wsl: distro || null };
  }
  // `/C:/Users/…` is a Windows drive path; drop the slash browsers put in front.
  return { directory: directory.replace(/^\/([A-Za-z]:)/, '$1'), wsl: null };
}

function isAbsolute(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

function joinPath(base: string, relative: string): string {
  return `${base.replace(/[\\/]+$/, '')}/${relative}`;
}

/** Collapse `.` and `..` segments and doubled slashes, keeping a drive or root. */
export function normalisePath(path: string): string {
  const unified = path.replace(/\\/g, '/');
  const drive = /^[A-Za-z]:/.exec(unified)?.[0] ?? '';
  const rooted = unified.slice(drive.length).startsWith('/');
  const parts: string[] = [];
  for (const segment of unified.slice(drive.length).split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return `${drive}${rooted ? '/' : ''}${parts.join('/')}`;
}

/** The reader's editor, else the document's `files-editor`, else VS Code. */
export function chosenEditor(docPage: Element | null): EditorId {
  const stored = readStoredEditor();
  if (stored) return stored;
  const fallback = docPage?.getAttribute('files-editor')?.trim() ?? '';
  return isEditorId(fallback) ? fallback : 'vscode';
}

function isEditorId(value: string): value is EditorId {
  return (EDITOR_IDS as readonly string[]).includes(value);
}

/**
 * why `localStorage` directly rather than the document store (§9.1): the store
 * is one blob per `doc-id`, and an editor is a fact about the reader's machine,
 * not about one plan — picking it again for every document would be the
 * annoyance this exists to remove.
 */
function readStoredEditor(): EditorId | null {
  const value = probeStorage()?.getItem(EDITOR_KEY) ?? '';
  return isEditorId(value) ? value : null;
}

export function storeEditor(editor: EditorId): void {
  probeStorage()?.setItem(EDITOR_KEY, editor);
  document.dispatchEvent(new CustomEvent(EDITOR_CHANGE_EVENT, { detail: editor }));
}

// ── The chip ─────────────────────────────────────────────────────────────

/**
 * A path chip: a `<code>` with the path, wrapped in a link to the reader's
 * editor when the document says where the project lives.
 *
 * `base` is a folder the path is relative to, inside the root — a
 * `doc-file-group`'s `path` — so the chip can stay short.
 *
 * Without `files-root` it is the plain `<code>` it always was. With one, a
 * click opens the file in the current editor straight away; with "copy" chosen
 * it copies the full path. The editor is changed from the picker
 * (`editorPicker`), never from the chip.
 *
 * why every chip carries a `title`: a `doc-file` sits inside a group whose own
 * `title` attribute the browser shows as a tooltip on everything inside it, so
 * without one of its own a path read "Database" on hover.
 */
export function pathChip(
  owner: HTMLElement,
  relative: string,
  line: number | null,
  base = '',
): HTMLElement {
  const label = line ? `${relative}:${line}` : relative;
  const code = createPart('path', 'code', { text: label });
  const docPage = owner.closest('doc-page');
  const joined = base && !isAbsolute(relative) ? joinPath(base, relative) : relative;
  const target = resolveTarget(docPage, joined, line);
  if (!target) {
    code.title = joined;
    return code;
  }

  const link = createPart('link', 'a') as HTMLAnchorElement;
  link.append(code);
  link.dataset.filePath = target.path;
  const render = (): void => renderLink(link, target, chosenEditor(docPage));
  render();

  link.addEventListener('click', (event) => {
    if (chosenEditor(docPage) !== 'none') return; // the href opens it
    event.preventDefault();
    void copyPath(link, target.path);
  });
  document.addEventListener(EDITOR_CHANGE_EVENT, () => {
    if (link.isConnected) render();
  });
  return link;
}

function renderLink(link: HTMLAnchorElement, target: FileTarget, editor: EditorId): void {
  const url = editorUrl(editor, target);
  // "Copy" keeps an href too, so the chip stays a focusable, Enter-able link;
  // the click handler copies instead of following it.
  link.href = url ?? `#${encodeURIComponent(target.path)}`;
  link.dataset.editor = editor;
  link.title = editor === 'none' ? `Copy ${target.path}` : target.path;
}

async function copyPath(link: HTMLElement, path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    link.dataset.copied = '';
    setTimeout(() => delete link.dataset.copied, 1200);
  } catch {
    // Clipboard refused (no permission, insecure context): the title still shows it.
  }
}

// ── The picker ───────────────────────────────────────────────────────────

/**
 * The editor control: a small button showing the current editor's mark, and
 * the menu it opens — every editor with its mark and name, then "copy".
 * Picking one saves it for this browser and re-links every path on the page.
 *
 * A menu button in the WAI-ARIA sense: `aria-haspopup`/`aria-expanded` on the
 * button, `menuitemradio` items, arrow keys and Home/End move, Escape and Tab
 * close and give focus back.
 */
export function editorPicker(docPage: Element | null): HTMLElement {
  const picker = createPart('editor-picker', 'div');
  const button = createPart('editor-button', 'button') as HTMLButtonElement;
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');

  const menu = createPart('editor-menu', 'div');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Open files in');
  menu.hidden = true;
  const items = EDITOR_IDS.map((editor) => menuItem(editor, () => pick(editor)));
  menu.append(...items);
  picker.append(button, menu);

  const renderButton = (): void => {
    const editor = chosenEditor(docPage);
    button.replaceChildren(editorIcon(editor));
    const label = `Paths open in ${EDITOR_LABELS[editor]}. Change editor`;
    button.setAttribute('aria-label', label);
    button.title = label;
    for (const item of items) {
      item.setAttribute('aria-checked', String(item.dataset.editor === editor));
    }
  };
  const setOpen = (open: boolean, focus: 'first' | 'button' | null = null): void => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open && focus === 'first') currentItem(items, docPage).focus();
    if (!open && focus === 'button') button.focus();
  };
  const pick = (editor: EditorId): void => {
    storeEditor(editor);
    setOpen(false, 'button');
  };

  button.addEventListener('click', () => setOpen(menu.hidden, 'first'));
  menu.addEventListener('keydown', (event) => onMenuKey(event, items, setOpen));
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !picker.contains(event.target as Node)) setOpen(false);
  });
  document.addEventListener(EDITOR_CHANGE_EVENT, () => {
    if (picker.isConnected) renderButton();
  });
  renderButton();
  return picker;
}

function menuItem(editor: EditorId, onPick: () => void): HTMLButtonElement {
  const item = createPart('editor-option', 'button') as HTMLButtonElement;
  item.type = 'button';
  item.tabIndex = -1;
  item.setAttribute('role', 'menuitemradio');
  item.dataset.editor = editor;
  item.append(
    editorIcon(editor),
    createPart('editor-option-label', 'span', { text: EDITOR_LABELS[editor] }),
  );
  item.addEventListener('click', onPick);
  return item;
}

function currentItem(
  items: readonly HTMLButtonElement[],
  docPage: Element | null,
): HTMLButtonElement {
  const editor = chosenEditor(docPage);
  return items.find((item) => item.dataset.editor === editor) ?? (items[0] as HTMLButtonElement);
}

function onMenuKey(
  event: KeyboardEvent,
  items: readonly HTMLButtonElement[],
  setOpen: (open: boolean, focus?: 'first' | 'button' | null) => void,
): void {
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  const moves: Record<string, number> = {
    ArrowDown: (index + 1) % items.length,
    ArrowUp: (index - 1 + items.length) % items.length,
    Home: 0,
    End: items.length - 1,
  };
  const target = moves[event.key];
  if (target !== undefined) {
    event.preventDefault();
    items[target]?.focus();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    setOpen(false, 'button');
  }
  if (event.key === 'Tab') setOpen(false);
}

/**
 * Give a page that has path links but no `doc-files` block its own picker,
 * fixed in the corner, so the reader can still choose. Runs once per page.
 */
export function ensurePagePicker(docPage: Element | null): void {
  if (!docPage?.getAttribute('files-root')) return;
  if (docPage.querySelector('doc-files, [data-part="editor-picker"]')) return;
  const picker = editorPicker(docPage);
  picker.dataset.placement = 'page';
  docPage.append(picker);
}
