import type { MetadataRoute } from 'next';
import { canonicalUrl } from '@/lib/site';
import { source } from '@/lib/source';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', ...source.getPages().map((page) => page.url)].map((path) => ({
    url: canonicalUrl(path),
  }));
}
