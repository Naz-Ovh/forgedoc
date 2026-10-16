/**
 * Editor URLs for path chips. The formats are the ones each editor's own URL
 * handler parses (see `src/core/editor-links.ts`), so these pin the exact
 * strings rather than their shape.
 */

import { describe, expect, it } from 'vitest';

import {
  documentLocation,
  editorUrl,
  normalisePath,
  resolveTarget,
} from '../../src/core/editor-links.js';

const LOCAL = { path: '/home/me/app/src/main.ts', wsl: null, line: 42 };
const WSL = { path: '/mnt/wsl/app/src/main.ts', wsl: 'FedoraLinux-44', line: 7 };

/** A stand-in for `doc-page`: the resolver only reads attributes. */
function page(attributes: Record<string, string>): Element {
  return { getAttribute: (name: string) => attributes[name] ?? null } as unknown as Element;
}

const NOWHERE = { protocol: 'https:', host: 'example.com', pathname: '/plan.html' };

describe('editorUrl', () => {
  it('builds the VS Code family of local file URLs with line and column', () => {
    expect(editorUrl('vscode', LOCAL)).toBe('vscode://file/home/me/app/src/main.ts:42:1');
    expect(editorUrl('vscode-insiders', LOCAL)).toBe(
      'vscode-insiders://file/home/me/app/src/main.ts:42:1',
    );
    expect(editorUrl('cursor', LOCAL)).toBe('cursor://file/home/me/app/src/main.ts:42:1');
    expect(editorUrl('windsurf', LOCAL)).toBe('windsurf://file/home/me/app/src/main.ts:42:1');
  });

  it('routes a WSL path through vscode-remote, always with a line so it opens as a file', () => {
    expect(editorUrl('vscode', WSL)).toBe(
      'vscode://vscode-remote/wsl+FedoraLinux-44/mnt/wsl/app/src/main.ts:7:1',
    );
    expect(editorUrl('cursor', { ...WSL, line: null })).toBe(
      'cursor://vscode-remote/wsl+FedoraLinux-44/mnt/wsl/app/src/main.ts:1:1',
    );
  });

  it('sends a WSL file to Zed for Windows as a \\\\wsl.localhost share path', () => {
    expect(editorUrl('zed', WSL)).toBe(
      'zed://file//wsl.localhost/FedoraLinux-44/mnt/wsl/app/src/main.ts:7',
    );
    // Zed running inside WSL opens the Linux path directly.
    expect(editorUrl('zed-linux', WSL)).toBe('zed://file/mnt/wsl/app/src/main.ts:7');
  });

  it('builds Zed and JetBrains URLs', () => {
    expect(editorUrl('zed', LOCAL)).toBe('zed://file/home/me/app/src/main.ts:42');
    expect(editorUrl('zed-linux', LOCAL)).toBe('zed://file/home/me/app/src/main.ts:42');
    expect(editorUrl('idea', LOCAL)).toBe(
      'idea://open?file=%2Fhome%2Fme%2Fapp%2Fsrc%2Fmain.ts&line=42',
    );
  });

  it('keeps a Windows drive path and escapes spaces', () => {
    expect(editorUrl('vscode', { path: 'C:/My Repo/a.ts', wsl: null, line: 3 })).toBe(
      'vscode://file/C:/My%20Repo/a.ts:3:1',
    );
  });

  it('has no URL for "none"', () => {
    expect(editorUrl('none', LOCAL)).toBeNull();
  });
});

describe('resolveTarget', () => {
  it('joins a relative path onto an absolute root and collapses dots', () => {
    const target = resolveTarget(page({ 'files-root': '/repo/' }), './src/../lib/a.ts', 5, NOWHERE);
    expect(target).toEqual({ path: '/repo/lib/a.ts', wsl: null, line: 5 });
  });

  it('returns nothing without a root, so the chip stays plain', () => {
    expect(resolveTarget(page({}), 'src/a.ts', null, NOWHERE)).toBeNull();
  });

  it('resolves a relative root against the plan file, and finds the WSL distro in its URL', () => {
    const location = {
      protocol: 'file:',
      host: 'wsl.localhost',
      pathname: '/FedoraLinux-44/home/me/repo/docs/plans/PLAN_x.html',
    };
    expect(resolveTarget(page({ 'files-root': '../..' }), 'apps/a.ts', null, location)).toEqual({
      path: '/home/me/repo/apps/a.ts',
      wsl: 'FedoraLinux-44',
      line: null,
    });
  });

  it('lets an explicit files-wsl win, and cannot resolve a relative root over http', () => {
    const target = resolveTarget(
      page({ 'files-root': '/repo', 'files-wsl': 'Ubuntu' }),
      'a.ts',
      null,
      NOWHERE,
    );
    expect(target?.wsl).toBe('Ubuntu');
    expect(resolveTarget(page({ 'files-root': '..' }), 'a.ts', null, NOWHERE)).toBeNull();
  });
});

describe('documentLocation and normalisePath', () => {
  it('reads a Windows drive path from a file URL', () => {
    expect(
      documentLocation({ protocol: 'file:', host: '', pathname: '/C:/work/repo/PLAN.html' }),
    ).toEqual({ directory: 'C:/work/repo/', wsl: null });
  });

  it('collapses dots without escaping the root', () => {
    expect(normalisePath('/a/b/../../../c//d/./e')).toBe('/c/d/e');
    expect(normalisePath('C:\\x\\..\\y')).toBe('C:/y');
  });
});
