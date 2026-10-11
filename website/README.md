# ForgeDoc documentation website

Fumadocs and Next.js power the public-facing handbook. Google Sans Flex and JetBrains Mono are self-hosted through Fontsource. This app is separate from the published document runtime.

## Develop

From the repository root:

```sh
npm install --prefix website
npm run docs:site:dev
```

Open `http://localhost:3000`. The app provides light and dark themes, static client-side search, a component reference, and per-page Markdown actions.

## Build and verify

```sh
npm run docs:generate
npm run docs:site:build
npm run docs:site:check
npm run check
```

The production website is exported to `website/out/`. Serve this directory with any static host that supports directory indexes. `next start` is not used for a static export.

The app has its own npm lockfile; `npm ci --prefix website` installs reproducibly. Its dependencies are not part of the library package or runtime bundles.

## Content sources

Handwritten guides live in `content/docs/`. `scripts/prepare.mjs` splits the committed `docs/REFERENCE.md` into component pages and imports `docs/CHEATSHEET.md`; it also reads the library version from the root package. These derived files are ignored by Git.

Edit the contract and `tools/element-docs.ts`, then run `npm run docs:generate` to change the API reference. Never hand-edit `content/docs/reference/`.

The website prepares reference pages before development and production builds. Its own typecheck also prepares content and generated types.

## Agent access and discovery

- `/llms.txt`: Markdown documentation index.
- `/llms-full.txt`: the entire handbook as text.
- `/llm.txt` and `/llm-full.txt`: aliases of the same automatically generated exports.
- `/markdown/<page>.md`: a single page, including `/markdown/index.md` for the docs landing page.
- `/api/search`: build-time search index queried in the browser.
- `/robots.txt` and `/sitemap.xml`: discovery metadata.

The canonical production URL is `https://forgedoc.naz.ovh`. Set `DOCS_SITE_URL`
before building only when deploying to a different canonical host. Every HTML
page gets its own canonical URL; robots.txt links to the populated sitemap.
The landing-page byline, author metadata, and structured data link
H. Nazmul Hasan to his personal site, `https://naz.ovh`.

These features support retrieval and public crawling once deployed. Inclusion in an LLM's future training dataset is controlled by the provider and is not guaranteed by this website.

The exports use Fumadocs' `llms()` utility over the same page source as the UI,
with `includeProcessedMarkdown` enabled in the MDX compiler. They are regenerated
at every static build, including newly added pages. No text-file inventory is
maintained by hand. The content check also validates internal links and generated
component coverage.

## Publish

The site is hosted on Cloudflare Workers Static Assets at
[forgedoc.naz.ovh](https://forgedoc.naz.ovh). No Next.js server is deployed.

```sh
npm ci --prefix website
npm exec --prefix website -- wrangler login
npm run docs:site:deploy
```

`docs:site:deploy` builds and checks the static export, then publishes with the
pinned Wrangler CLI. `wrangler.jsonc` selects the account owning `naz.ovh` and
configures the `forgedoc.naz.ovh` custom domain, including Cloudflare-managed DNS
and HTTPS. Login is needed only when this machine has no valid Cloudflare session.

For a read-only deployment configuration check after building:

```sh
npm exec --prefix website -- wrangler deploy --cwd website --dry-run
```

The deploy output is `website/out`. Cloudflare serves directory indexes, JSON
search data, Markdown and text routes, and a real 404 for unknown paths. After
publishing, verify the homepage, `/docs/quick-start/`, `/api/search`, `/llms.txt`,
`/llms-full.txt`, `/robots.txt`, and `/sitemap.xml` on the custom domain.
