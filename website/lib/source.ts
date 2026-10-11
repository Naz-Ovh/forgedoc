import { llms, loader } from 'fumadocs-core/source';
import { docs } from '@/.source/server';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export async function pageMarkdown(
  page: ReturnType<typeof source.getPages>[number],
): Promise<string> {
  return `# ${page.data.title}\n\n${page.data.description ?? ''}\n\n${await page.data.getText('processed')}`;
}

// Processed Markdown and the page tree share the source used by the rendered site.
export const docsLlms = llms(source, { renderPage: pageMarkdown });

export function llmsIndex(): string {
  const markdownUrls = new Map(
    source
      .getPages()
      .map((page) => [
        page.url,
        `/markdown/${page.slugs.length ? page.slugs.join('/') : 'index'}.md`,
      ]),
  );
  const index = docsLlms.index().replace(/\]\(([^)]+)\)/g, (link, url: string) => {
    const markdown = markdownUrls.get(url);
    return markdown ? `](${markdown})` : link;
  });
  return `${index}\n\n## Complete text\n\n- [Full documentation](/llms-full.txt)\n`;
}
