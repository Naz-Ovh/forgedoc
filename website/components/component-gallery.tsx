import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

const components = [
  {
    tag: 'doc-section',
    title: 'Give the document structure',
    text: 'Nested sections, derived numbering, and navigation.',
  },
  {
    tag: 'doc-choice',
    title: 'Make a decision answerable',
    text: 'Single or multiple choices, notes, and an Other answer.',
  },
  {
    tag: 'doc-code',
    title: 'Show the implementation',
    text: 'Highlighted code, a filename header, and copying.',
  },
  {
    tag: 'doc-figure',
    title: 'Explain it visually',
    text: 'Mermaid diagrams, images, captions, and block feedback.',
  },
  {
    tag: 'doc-steps',
    title: 'Turn instructions into actions',
    text: 'A readable sequence with a title and status per step.',
  },
  {
    tag: 'doc-endpoint',
    title: 'Document an exact interface',
    text: 'HTTP methods, paths, parameters, and request examples.',
  },
];

export function ComponentGallery(): ReactElement {
  return (
    <section className="component-section" id="components">
      <div className="section-heading">
        <div>
          <span className="page-eyebrow">01 / THE COMPONENT LIBRARY</span>
          <h2>Useful structure. Built-in feedback.</h2>
        </div>
        <Link href="/docs/reference">
          All components <ArrowRight size={15} />
        </Link>
      </div>
      <p className="section-intro">
        Sections, questions, code, diagrams, and API details share the same document runtime.
        Readers can comment on prose and leave feedback on blocks they cannot select.
      </p>
      <div className="component-grid">
        {components.map((component) => (
          <Link
            href={`/docs/reference/${component.tag}`}
            className="component-card"
            key={component.tag}
          >
            <code>{`<${component.tag}>`}</code>
            <ArrowRight size={14} className="component-arrow" />
            <h3>{component.title}</h3>
            <p>{component.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
