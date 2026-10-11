'use client';

import { ArrowRight, Check, Copy, MessageSquare, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

const OPTIONS = ['Shared team inbox', 'Per-person read state'];
const PARAGRAPH = 'Every order has one owner. The whole team can see what needs attention.';

function feedbackText(choice: number, comment: string, quote: string, timestamp: string): string {
  const entries = [
    `[1] ANSWER q-should-read-state-be-shared\nq: Should read state be shared?\na: ${OPTIONS[choice]}`,
  ];
  if (comment) {
    const continued = comment.replace(/\n/g, '\n   ');
    entries.push(
      `[2] COMMENT sec-the-approach\nat: 1 The approach\n> ${quote.replace(/\n/g, '\n   ')}\nc: ${continued}`,
    );
  }
  return `=== FB v1 · vendor-orders · ${timestamp} · ${entries.length} items ===\n\n${entries.join('\n\n')}\n\n=== end FB v1 ===`;
}

function ReadStateChoice({
  choice,
  onChange,
}: {
  choice: number;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <div className="preview-question">
      <span className="preview-question-label">
        <MessageSquare size={13} /> AN OPEN QUESTION
      </span>
      <h3>Should read state be shared?</h3>
      <fieldset aria-label="Should read state be shared?">
        {OPTIONS.map((option, index) => (
          <label className="preview-option" data-selected={choice === index} key={option}>
            <input
              className="sr-only"
              type="radio"
              name="preview-read-state"
              aria-label={option}
              value={option}
              checked={choice === index}
              onChange={() => onChange(index)}
            />
            <span className="option-letter">{index === 0 ? 'A' : 'B'}</span>
            <span>
              {option}
              {index === 0 && <small>Recommended</small>}
            </span>
            <span className="option-radio">{choice === index && <Check size={12} />}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function CommentComposer({
  quote,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  quote: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}): ReactElement {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <div className="demo-composer">
      <blockquote>“{quote}”</blockquote>
      <label htmlFor="demo-comment">What should your AI change?</label>
      <textarea
        id="demo-comment"
        ref={input}
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Could two people share ownership during a handover?"
      />
      <div>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" disabled={!value.trim()} onClick={onSave}>
          <Plus size={12} /> Add to feedback
        </button>
      </div>
    </div>
  );
}

export function LoopPreview(): ReactElement {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [choice, setChoice] = useState(0);
  const [quote, setQuote] = useState(PARAGRAPH);
  const [savedQuote, setSavedQuote] = useState(PARAGRAPH);
  const [draft, setDraft] = useState('');
  const [comment, setComment] = useState('');
  const [composing, setComposing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [timestamp, setTimestamp] = useState('');
  // The static HTML and first client render must agree; fill time after hydration.
  useEffect(() => {
    setTimestamp(new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
  }, []);
  const bucket = timestamp ? feedbackText(choice, comment, savedQuote, timestamp) : '';

  function selectText(): void {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    if (!paragraph.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    setQuote(selection.toString().trim());
    setComposing(true);
  }

  async function copyFeedback(): Promise<void> {
    try {
      const copyTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      setTimestamp(copyTime);
      await navigator.clipboard.writeText(feedbackText(choice, comment, savedQuote, copyTime));
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="loop-preview" id="feedback-demo">
      <div className="preview-toolbar">
        <span>
          <span className="status-dot" /> TRY THE FEEDBACK LOOP
        </span>
        <span>vendor-orders.html</span>
      </div>
      <div className="preview-document">
        <div className="preview-kicker">A SMALL DOCUMENT. A REAL RESPONSE.</div>
        <h2>The vendor inbox</h2>
        <div className="demo-prose">
          <p ref={paragraph} onPointerUp={selectText}>
            {PARAGRAPH}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuote(PARAGRAPH);
              setComposing(true);
            }}
          >
            <MessageSquare size={12} /> Comment on this paragraph
          </button>
          <small>Try selecting a few words above to comment on that exact text.</small>
        </div>
        {composing && (
          <CommentComposer
            quote={quote}
            value={draft}
            onChange={setDraft}
            onCancel={() => setComposing(false)}
            onSave={() => {
              setComment(draft.trim());
              setSavedQuote(quote);
              setComposing(false);
            }}
          />
        )}
        <ReadStateChoice choice={choice} onChange={setChoice} />
        {comment && (
          <div className="saved-comment">
            <Check size={13} />
            <span>Comment collected: {comment}</span>
            <button type="button" onClick={() => setComment('')}>
              Remove
            </button>
          </div>
        )}
        <div className="preview-feedback">
          <span>
            <span className="feedback-count">{comment ? 2 : 1}</span> {comment ? 'items' : 'answer'}{' '}
            ready for your AI
          </span>
          <button type="button" onClick={copyFeedback}>
            {status === 'copied' ? <Check size={14} /> : <Copy size={14} />}
            {status === 'copied' ? 'Copied' : 'Copy feedback'}
          </button>
        </div>
        <details className="demo-bucket">
          <summary>View the collected FB v1 block</summary>
          <pre>{bucket}</pre>
        </details>
        <span className={status === 'error' ? 'preview-error' : 'sr-only'} role="status">
          {status === 'error'
            ? 'Clipboard unavailable. Open the feedback block above and copy it manually.'
            : status === 'copied'
              ? 'Feedback copied. Paste it back to your AI.'
              : ''}
        </span>
      </div>
      <LinkCaption />
    </div>
  );
}

function LinkCaption(): ReactElement {
  return (
    <a className="preview-caption" href="/docs/feedback-format">
      Interactive walkthrough · read the feedback format <ArrowRight size={13} />
    </a>
  );
}
