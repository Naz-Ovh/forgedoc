import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

const themes = [
  {
    name: 'Default',
    slug: 'default',
    label: 'THE EVERYDAY READER',
    description: 'Balanced spacing and friendly type.',
    fonts: 'Plus Jakarta Sans · JetBrains Mono',
  },
  {
    name: 'Geist',
    slug: 'geist',
    label: 'THE TECHNICAL REFERENCE',
    description: 'Tighter rhythm. Precise, quiet detail.',
    fonts: 'Geist Sans · Geist Mono',
  },
  {
    name: 'Bun',
    slug: 'bun',
    label: 'THE BOLD PRESENTATION',
    description: 'Strong contrast and a pink accent.',
    fonts: 'Archivo · Martian Mono · system body',
  },
  {
    name: 'ForgeDoc',
    slug: 'forgedoc',
    label: 'THE ORIGINAL EDITORIAL',
    description: 'Teal accents and generous reading space.',
    fonts: 'System sans-serif · system monospace',
  },
];

export function ThemeGallery(): ReactElement {
  return (
    <section className="theme-section" id="themes">
      <div className="section-heading">
        <div>
          <span className="page-eyebrow">02 / DOCUMENT THEMES</span>
          <h2>Four themes. The same conversation.</h2>
        </div>
        <Link href="/docs/themes">
          Themes & customization <ArrowRight size={15} />
        </Link>
      </div>
      <p className="section-intro">
        Select a theme when you build. Each supports light and dark appearance and the same
        component vocabulary.
      </p>
      <div className="theme-grid">
        {themes.map((theme) => (
          <Link
            className={`theme-card theme-${theme.slug}`}
            href={`/docs/themes/#${theme.slug}`}
            key={theme.slug}
          >
            <div className="theme-swatch" aria-hidden="true">
              <span className="theme-light">
                Aa
                <span />
                <small>LIGHT</small>
              </span>
              <span className="theme-dark">
                Aa
                <span />
                <small>DARK</small>
              </span>
            </div>
            <div className="theme-card-body">
              <span className="theme-label">{theme.label}</span>
              <h3>
                {theme.name}
                <ArrowRight size={14} />
              </h3>
              <p>{theme.description}</p>
              <small>{theme.fonts}</small>
              <code>{`--theme ${theme.slug}`}</code>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
