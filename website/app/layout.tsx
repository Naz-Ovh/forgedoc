import '@fontsource-variable/google-sans-flex';
import '@fontsource-variable/jetbrains-mono';
import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { author, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: siteUrl,
  authors: [{ name: author.name, url: author.url }],
  creator: author.name,
  title: { default: 'ForgeDoc — Documents you can answer', template: '%s · ForgeDoc' },
  description:
    'Collect inline comments and decisions into structured feedback you can paste back to your AI. Explore ForgeDoc components, four document themes, and the FB v1 format.',
  openGraph: {
    title: 'ForgeDoc — Documents you can answer',
    type: 'website',
    siteName: 'ForgeDoc',
  },
  robots: { index: true, follow: true },
};

// Next.js route modules require a default component export.
export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider search={{ options: { type: 'static' } }}>{children}</RootProvider>
      </body>
    </html>
  );
}
