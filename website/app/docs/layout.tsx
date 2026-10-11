import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactElement, ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }): ReactElement {
  return (
    <DocsLayout
      {...baseOptions()}
      links={[]}
      tree={source.getPageTree()}
      sidebar={{ defaultOpenLevel: 0 }}
    >
      {children}
    </DocsLayout>
  );
}
