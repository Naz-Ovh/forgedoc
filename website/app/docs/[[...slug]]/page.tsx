import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { PageActions } from '@/components/page-actions';
import { canonicalUrl } from '@/lib/site';
import { source } from '@/lib/source';

type Props = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams(): { slug: string[] }[] {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: canonicalUrl(page.url) },
    openGraph: {
      title: `${page.data.title} · ForgeDoc`,
      description: page.data.description,
      type: 'article',
      siteName: 'ForgeDoc',
      url: canonicalUrl(page.url),
    },
  };
}

export default async function Page({ params }: Props): Promise<ReactElement> {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  const Content = page.data.body;
  const markdownUrl = `/markdown/${page.slugs.length ? page.slugs.join('/') : 'index'}.md`;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="page-eyebrow">THE FORGEDOC HANDBOOK</div>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <PageActions markdownUrl={markdownUrl} />
      <DocsBody>
        <Content components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}
