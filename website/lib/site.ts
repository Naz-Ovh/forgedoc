export const siteUrl = new URL(process.env.DOCS_SITE_URL ?? 'https://forgedoc.naz.ovh');

export const author = {
  name: 'H. Nazmul Hasan',
  url: 'https://naz.ovh',
  id: 'https://naz.ovh/#person',
};

export function canonicalUrl(path: string): string {
  return new URL(path.endsWith('/') ? path : `${path}/`, siteUrl).href;
}

export const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Person', '@id': author.id, name: author.name, url: author.url },
    {
      '@type': 'WebSite',
      '@id': `${canonicalUrl('/')}#website`,
      name: 'ForgeDoc',
      url: canonicalUrl('/'),
      author: { '@id': author.id },
      inLanguage: 'en',
    },
    {
      '@type': 'SoftwareSourceCode',
      '@id': `${canonicalUrl('/')}#software`,
      name: 'ForgeDoc',
      description:
        'Semantic HTML documents with inline decisions, comments, and structured feedback for AI agents.',
      url: canonicalUrl('/'),
      codeRepository: 'https://github.com/naz-ovh/forgedoc',
      license: 'https://github.com/naz-ovh/forgedoc/blob/main/LICENSE',
      author: { '@id': author.id },
      programmingLanguage: 'TypeScript',
    },
  ],
};
