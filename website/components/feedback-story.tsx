import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

export function FeedbackStory(): ReactElement {
  return (
    <section className="feedback-story">
      <div className="feedback-story-copy">
        <span className="page-eyebrow">THE PART THAT CLOSES THE LOOP</span>
        <h2>Feedback travels with its context.</h2>
        <p>
          A comment means more when the AI gets the exact sentence, its location, and the reader’s
          words together. A decision means more when it carries the question and the chosen label.
        </p>
        <p>
          The feedback collector packages both. Copy the bucket, paste it into your conversation,
          and let the agent revise the same document.
        </p>
        <Link href="/docs/feedback-format">
          Read the FB v1 format <ArrowRight size={15} />
        </Link>
      </div>
      <div className="feedback-wire">
        <div className="wire-heading">
          <span>WHAT YOUR AI RECEIVES</span>
          <code>FB v1</code>
        </div>
        <pre>{`[1] ANSWER q-shared-read-state
q: Should read state be shared?
a: Shared team inbox

[2] COMMENT sec-the-approach
> Every order has one owner
c: Can two people share ownership
   during a handover?`}</pre>
        <div className="wire-caption">Question. Answer. Quotation. Comment. No lost context.</div>
      </div>
    </section>
  );
}
