import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { ArrowDown, ArrowRight, BookOpen, Code2, FileCode2, Layers, Terminal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { ComponentGallery } from '@/components/component-gallery';
import { FeedbackStory } from '@/components/feedback-story';
import { LoopPreview } from '@/components/loop-preview';
import { ThemeGallery } from '@/components/theme-gallery';
import { baseOptions } from '@/lib/layout.shared';
import { author, canonicalUrl, structuredData } from '@/lib/site';
import { version } from '@/lib/version';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/') },
  openGraph: {
    title: 'ForgeDoc — Documents you can answer',
    description: 'Inline comments and decisions, collected into structured feedback for your AI.',
    type: 'website',
    siteName: 'ForgeDoc',
    url: canonicalUrl('/'),
  },
};

const paths = [
  {
    icon: Terminal,
    number: '01',
    title: 'Make your first document',
    description: 'Install the CLI. Write a little HTML. Open something worth reading.',
    href: '/docs/quick-start',
    label: 'Start building',
  },
  {
    icon: Code2,
    number: '02',
    title: 'Give your agent the vocabulary',
    description: 'A precise authoring contract, working examples, and a reliable feedback loop.',
    href: '/docs/agents',
    label: 'Read the agent guide',
  },
  {
    icon: Layers,
    number: '03',
    title: 'Know every moving part',
    description: 'The complete component contract, runtime API, and reasons behind the design.',
    href: '/docs/reference',
    label: 'Explore the reference',
  },
];

function Hero(): ReactElement {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="author-credit">
          Created by{' '}
          <a href={author.url} rel="author">
            {author.name}
          </a>
        </p>
        <Link href="/docs/quick-start" className="release-pill">
          <span className="status-dot" /> ForgeDoc {version}
          <span className="pill-divider" /> The documentation handbook <ArrowRight size={13} />
        </Link>
        <h1>
          Your document.
          <br />
          Your feedback.
          <br />
          <span>Back to your AI.</span>
        </h1>
        <p className="hero-description">
          Select a sentence. Leave a comment. Answer an open question. ForgeDoc collects it all into
          one structured block you can paste back to your coding agent.
        </p>
        <div className="hero-buttons">
          <a className="button-primary" href="#feedback-demo">
            Try the feedback collector <ArrowRight size={16} />
          </a>
          <Link className="button-secondary" href="/docs/feedback">
            How feedback works <ArrowRight size={16} />
          </Link>
        </div>
        <div className="install-command">
          <span aria-hidden="true">$</span>
          <code>npm install -g forgedoc</code>
          <span className="install-label">GET STARTED</span>
        </div>
        <div className="hero-facts">
          <span>Plain HTML</span>
          <span>Light DOM</span>
          <span>Offline ready</span>
          <span>MIT licensed</span>
        </div>
      </div>
      <LoopPreview />
    </section>
  );
}

function Workflow(): ReactElement {
  return (
    <section className="loop-strip" aria-label="The ForgeDoc workflow">
      <div>
        <span className="step-index">01</span>
        <span>Write the meaning</span>
        <code>doc-*</code>
      </div>
      <ArrowRight className="strip-arrow" size={16} />
      <div>
        <span className="step-index">02</span>
        <span>Build the document</span>
        <code>forgedoc build</code>
      </div>
      <ArrowRight className="strip-arrow" size={16} />
      <div>
        <span className="step-index">03</span>
        <span>Read. Answer. Refine.</span>
        <code>FB v1</code>
      </div>
    </section>
  );
}

function ReadingPaths(): ReactElement {
  return (
    <section className="reading-paths">
      <div className="section-heading">
        <div>
          <span className="page-eyebrow">A HANDBOOK, THREE WAYS IN</span>
          <h2>Pick up where you are.</h2>
        </div>
        <Link href="/docs">
          All documentation <ArrowRight size={15} />
        </Link>
      </div>
      <div className="path-grid">
        {paths.map((path) => (
          <Link href={path.href} className="path-card" key={path.number}>
            <div className="path-top">
              <path.icon size={22} strokeWidth={1.5} />
              <span>{path.number}</span>
            </div>
            <h3>{path.title}</h3>
            <p>{path.description}</p>
            <span className="path-link">
              {path.label}
              <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MarkupSection(): ReactElement {
  return (
    <section className="markup-section">
      <div className="markup-copy">
        <span className="page-eyebrow">SMALL SOURCE. COMPLETE EXPERIENCE.</span>
        <h2>
          Write what it means.
          <br />
          Let the runtime do its job.
        </h2>
        <p>
          No hand-built option controls. No section numbers to maintain. No CSS or JavaScript for
          your agent to reinvent with every document.
        </p>
        <Link href="/docs/authoring">
          Learn the authoring model <ArrowRight size={16} />
        </Link>
      </div>
      <div className="markup-code">
        <div className="code-toolbar">
          <FileCode2 size={14} />
          <span>PLAN_vendor-orders.html</span>
          <span>HTML</span>
        </div>
        <pre>
          <code>
            <span className="code-comment">{'<!-- Meaning in. A readable document out. -->'}</span>
            {'\n'}
            <span className="code-tag">{'<doc-page'}</span>
            {' doc-id='}
            <span className="code-string">{'"vendor-orders"'}</span>
            <span className="code-tag">{'>'}</span>
            {'\n  '}
            <span className="code-tag">{'<doc-section'}</span>
            {' title='}
            <span className="code-string">{'"The approach"'}</span>
            <span className="code-tag">{'>'}</span>
            {'\n    <p>One shared inbox for the whole team.</p>\n  '}
            <span className="code-tag">{'</doc-section>'}</span>
            {'\n\n  '}
            <span className="code-tag">{'<doc-choice'}</span>
            {' mode='}
            <span className="code-string">{'"single"'}</span>
            {'\n    question='}
            <span className="code-string">{'"Should read state be shared?"'}</span>
            <span className="code-tag">{'>'}</span>
            {'\n    '}
            <span className="code-tag">{'<doc-option recommended>'}</span>
            {'Shared inbox'}
            <span className="code-tag">{'</doc-option>'}</span>
            {'\n    '}
            <span className="code-tag">{'<doc-option>'}</span>
            {'Per-person state'}
            <span className="code-tag">{'</doc-option>'}</span>
            {'\n  '}
            <span className="code-tag">{'</doc-choice>'}</span>
            {'\n'}
            <span className="code-tag">{'</doc-page>'}</span>
          </code>
        </pre>
        <div className="code-footer">
          <Terminal size={13} />
          <code>forgedoc build PLAN_vendor-orders.html</code>
          <ArrowDown size={14} />
        </div>
      </div>
    </section>
  );
}

function AgentBanner(): ReactElement {
  return (
    <section className="agent-banner">
      <div className="agent-symbol" aria-hidden="true">
        {'{ }'}
      </div>
      <div>
        <span className="page-eyebrow">READABLE BY PEOPLE. RETRIEVABLE BY AGENTS.</span>
        <h2>The whole handbook, without the interface.</h2>
        <p>Every page has a Markdown version. One index points to all of them.</p>
      </div>
      <a href="/llms.txt">
        Open llms.txt <ArrowRight size={16} />
      </a>
    </section>
  );
}

function Footer(): ReactElement {
  return (
    <footer className="site-footer">
      <span>
        ForgeDoc<span className="brand-dot">.</span>{' '}
        <span className="footer-note">A little markup. A better conversation.</span>
      </span>
      <div>
        <Link href="/docs">
          <BookOpen size={13} /> Handbook
        </Link>
        <a href="/llms-full.txt">Full text</a>
        <a href="https://github.com/naz-ovh/forgedoc">Source ↗</a>
      </div>
    </footer>
  );
}

export default function Home(): ReactElement {
  return (
    <HomeLayout {...baseOptions()}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Trusted site metadata, escaped for the script context.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <main className="home-main">
        <Hero />

        <Workflow />

        <FeedbackStory />

        <ComponentGallery />

        <ThemeGallery />

        <ReadingPaths />

        <MarkupSection />

        <AgentBanner />
      </main>
      <Footer />
    </HomeLayout>
  );
}
