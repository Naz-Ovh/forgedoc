import { notFound } from 'next/navigation';
import { docsLlms, source } from '@/lib/source';

export const dynamic = 'force-static';

export function generateStaticParams(): { slug: string[] }[] {
  return source.getPages().map((page) => ({
    slug: `${page.slugs.length ? page.slugs.join('/') : 'index'}.md`.split('/'),
  }));
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ slug: string[] }>;
  },
): Promise<Response> {
  const path = (await params).slug.join('/');
  if (!path.endsWith('.md')) notFound();
  const slugs = path.slice(0, -3).split('/');
  const page = source.getPage(slugs[0] === 'index' && slugs.length === 1 ? [] : slugs);
  if (!page) notFound();
  return new Response(await docsLlms.page(page), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
