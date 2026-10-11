'use client';

import { Check, Copy, FileText } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';

export function PageActions({ markdownUrl }: { markdownUrl: string }): ReactElement {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copy(): Promise<void> {
    try {
      const response = await fetch(markdownUrl);
      if (!response.ok) throw new Error('Markdown unavailable');
      await navigator.clipboard.writeText(await response.text());
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }
  return (
    <div className="page-actions">
      <button type="button" onClick={copy}>
        {status === 'copied' ? <Check size={14} /> : <Copy size={14} />}
        {status === 'copied' ? 'Copied' : 'Copy for an agent'}
      </button>
      <a href={markdownUrl}>
        <FileText size={14} /> Open Markdown
      </a>
      <span role="status">
        {status === 'error' ? 'Copy failed. Open Markdown to copy manually.' : ''}
      </span>
    </div>
  );
}
