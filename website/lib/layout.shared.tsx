import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import type { ReactElement } from 'react';
import { version } from './version';

export function Brand(): ReactElement {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        f<span>:</span>
      </span>
      <span>
        ForgeDoc<span className="brand-dot">.</span>
      </span>
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <Brand /> },
    githubUrl: 'https://github.com/naz-ovh/forgedoc',
    links: [
      { text: 'Documentation', url: '/docs', active: 'nested-url' },
      { text: 'Feedback', url: '/docs/feedback', active: 'url' },
      { text: 'Components', url: '/docs/reference', active: 'nested-url' },
      { text: 'Themes', url: '/docs/themes', active: 'nested-url' },
      { text: 'For agents', url: '/docs/agents' },
      { text: `v${version}`, url: 'https://www.npmjs.com/package/forgedoc', external: true },
    ],
  };
}
