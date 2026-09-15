/**
 * The CLI entry point.
 *
 * Designed around agent consumption:
 *
 * 1. Output is either human prose with copy-pastable commands or JSON,
 *    controlled by `--format=json`.
 * 2. Exit codes are semantic: 0 on success, 1 on markup errors, 2 on bad flags.
 * 3. Every subcommand operates on files directly; there are no daemon or config
 *    requirements.
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { isKnownTag } from '../src/core/contract.js';
import { slugify } from '../src/core/slug.js';
import {
  elementDetail,
  elementSummaries,
  elementsJson,
  globalAttributesJson,
  normaliseTag,
  renderCheatsheet,
  renderElements,
  renderInfo,
  renderReference,
  renderSearch,
  searchDocs,
  suggestTags,
} from './docs.js';
import {
  availableThemes,
  type BundleFlavour,
  DEFAULT_THEME,
  injectAssets,
  type InjectionAssets,
  resolveAssets,
  themeFromPlaceholder,
  usesMermaid,
} from './inject.js';
import { formatJson, formatText, validateHtml } from './validate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = HERE.endsWith('dist') ? HERE : join(HERE, '../dist');

/** Commands supported by `forgedoc <command>`. */
export type Command =
  | 'build'
  | 'validate'
  | 'new'
  | 'elements'
  | 'info'
  | 'cheatsheet'
  | 'search'
  | 'reference'
  | 'themes'
  | 'version'
  | 'help';

/**
 * The read-only documentation commands.
 *
 * why they live in the CLI rather than a markdown file beside it: an authoring
 * agent has the binary on PATH long before it knows which files the package
 * shipped, and a file has to be kept in step by hand. These render from
 * `src/core/contract.ts` — the same data the validator enforces — so the docs
 * cannot describe markup that would fail the build.
 */
const DOCS_COMMANDS: readonly Command[] = [
  'elements',
  'info',
  'cheatsheet',
  'search',
  'reference',
  'themes',
];

interface ParsedArguments {
  readonly command: Command;
  readonly positionals: readonly string[];
  readonly flags: ReadonlyMap<string, string | boolean>;
  readonly unknownCommand?: string;
}

export async function run(argv: readonly string[]): Promise<number> {
  const parsed = parseArguments(argv);
  if (parsed.unknownCommand) {
    process.stderr.write(`forgedoc: unknown command "${parsed.unknownCommand}"\n\n${USAGE}`);
    return 1;
  }

  switch (parsed.command) {
    case 'build':
      return runBuild(parsed);
    case 'validate':
      return runValidate(parsed);
    case 'new':
      return runNew(parsed);
    case 'elements':
      return runElements(parsed);
    case 'info':
      return runInfo(parsed);
    case 'cheatsheet':
      return runCheatsheet(parsed);
    case 'search':
      return runSearch(parsed);
    case 'reference':
      return runReference(parsed);
    case 'themes':
      return runThemes(parsed);
    case 'version':
      return runVersion(parsed);
    case 'help':
      process.stdout.write(USAGE);
      return argv.length === 0 ? 1 : 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArguments(argv: readonly string[]): ParsedArguments {
  const [first, ...rest] = argv;

  if (first === undefined || first === '--help' || first === '-h') {
    return { command: 'help', positionals: [], flags: new Map() };
  }
  if (first === '--version' || first === '-v') {
    return { command: 'version', positionals: [], flags: new Map() };
  }

  const knownCommands = new Set<Command>([
    'build',
    'validate',
    'new',
    ...DOCS_COMMANDS,
    'version',
    'help',
  ]);
  if (!knownCommands.has(first as Command)) {
    return { command: 'help', positionals: [], flags: new Map(), unknownCommand: first };
  }

  const command = first as Command;
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === undefined) continue;

    if (!argument.startsWith('--')) {
      positionals.push(argument);
      continue;
    }

    const body = argument.slice(2);
    const equals = body.indexOf('=');
    if (equals >= 0) {
      flags.set(body.slice(0, equals), body.slice(equals + 1));
      continue;
    }

    // `--out <file>` takes the next argument; bare flags do not.
    const next = rest[index + 1];
    if (VALUE_FLAGS.has(body) && next !== undefined && !next.startsWith('--')) {
      flags.set(body, next);
      index += 1;
      continue;
    }
    flags.set(body, true);
  }

  return { command, positionals, flags };
}

const VALUE_FLAGS = new Set(['out', 'dir', 'format', 'theme', 'category']);

// ─────────────────────────────────────────────────────────────────────────────
// build
// ─────────────────────────────────────────────────────────────────────────────

async function runBuild(parsed: ParsedArguments): Promise<number> {
  const inputPath = parsed.positionals[0];
  if (!inputPath) {
    process.stderr.write(`forgedoc build: expected a file.\n\n${USAGE}`);
    return 1;
  }

  const source = await readSource(inputPath);
  if (source === null) return 1;

  if (parsed.flags.get('no-validate') !== true) {
    const result = validateHtml(source, { file: inputPath });
    process.stderr.write(`${formatText(result)}\n`);
    if (!result.ok) {
      process.stderr.write('\nforgedoc build: no output written.\n');
      return 1;
    }
  }

  const flavour: BundleFlavour = parsed.flags.get('offline') === true ? 'offline' : 'cdn';
  const themeFlag = parsed.flags.get('theme');
  const theme =
    typeof themeFlag === 'string' ? themeFlag : (themeFromPlaceholder(source) ?? DEFAULT_THEME);

  let assets: InjectionAssets;
  try {
    assets = await resolveAssets(flavour, DIST_DIR, theme);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`forgedoc build: ${message}\n`);
    return 1;
  }

  const outRaw = parsed.flags.get('out');
  const outFlag: string | true | undefined =
    typeof outRaw === 'string' ? outRaw : outRaw === true ? true : undefined;
  const history = parsed.flags.get('history') === true;
  const outputPath = resolveOutputPath(inputPath, outFlag, flavour, history);

  const built = injectAssets(source, assets);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, built, 'utf8');
  const archived = history ? await keepVersion(outputPath, built) : null;

  // Moving into a history folder leaves the file it came from behind, which is
  // the duplicate the folder exists to avoid.
  if (history && inputPath !== outputPath) await rm(inputPath, { force: true });

  const kilobytes = Math.round(Buffer.byteLength(built, 'utf8') / 1024);
  const themeLabel = theme ? `, theme "${theme}"` : '';
  process.stdout.write(
    `forgedoc build: wrote ${outputPath} (${kilobytes} kB, ${flavour}${themeLabel})\n`,
  );
  if (archived) process.stdout.write(`  kept this version as ${archived}\n`);

  if (flavour === 'offline') {
    warnAboutOfflineWeight(source, kilobytes, outFlag);
  }

  return 0;
}

/**
 * An offline build can be heavy (Mermaid alone is ~1 MB).
 *
 * Make sure the user notices, and explain *why* it is heavy so they don't treat
 * it as unexplained bloat — the IIFE format required for `file://` execution
 * cannot code-split and so carries every Mermaid diagram type at once.
 */
function warnAboutOfflineWeight(
  source: string,
  kilobytes: number,
  outFlag: string | true | undefined,
): void {
  if (usesMermaid(source)) {
    process.stderr.write(
      `\nforgedoc build: this document embeds Mermaid, which is most of the ${kilobytes} kB.\n` +
        '    Mermaid ships every diagram type in one file because an IIFE cannot code-split.\n' +
        '    A plan with no `<doc-figure type="mermaid">` embeds roughly 160 kB instead.\n',
    );
  }

  if (typeof outFlag === 'string') return;
  process.stderr.write(
    `    Do not commit this file — add \`${TEMP_DIRECTORY}/\` to .gitignore and send it directly.\n` +
      '    The committed plan should be the CDN build: `forgedoc build <file.html>`.\n',
  );
}

/** Where offline builds land unless told otherwise. Gitignored by convention. */
const TEMP_DIRECTORY = '.temp';

/** The living document inside a history folder. */
const HISTORY_INDEX = 'index.html';

/** Where superseded versions are kept. */
const HISTORY_DIRECTORY = 'history';

/**
 * Where the build writes.
 *
 * why in place: a plan is one document, not a source file and an artefact. The
 * reader opens the file, comments on it, the agent revises that same file and
 * builds it again. Writing `<name>.built.html` beside the input produced two
 * files that drift apart, and left the reader guessing which one to open.
 * `injectAssets` accepts its own output, so the single file survives any number
 * of revisions.
 *
 * Offline is the exception: a 3.5 MB embedded bundle is a delivery artefact, and
 * overwriting a 15 kB committed document with one is never what someone meant.
 */
function resolveOutputPath(
  inputPath: string,
  outFlag: string | true | undefined,
  flavour: BundleFlavour,
  history: boolean,
): string {
  if (typeof outFlag === 'string') return outFlag;

  const extension = extname(inputPath) || '.html';
  const stem = basename(inputPath, extension);

  if (flavour === 'offline') {
    return join(dirname(inputPath), TEMP_DIRECTORY, `${stem}${extension}`);
  }

  if (history) return join(historyFolder(inputPath), HISTORY_INDEX);

  return inputPath;
}

/**
 * The folder a kept-history document lives in.
 *
 * Building `PLAN_vendor-orders.html --history` gives `PLAN_vendor-orders/`;
 * building the `index.html` already inside that folder keeps it, rather than
 * nesting a folder per revision.
 */
function historyFolder(inputPath: string): string {
  if (basename(inputPath) === HISTORY_INDEX) return dirname(inputPath);
  const extension = extname(inputPath) || '.html';
  return join(dirname(inputPath), basename(inputPath, extension));
}

/**
 * Keep a copy of what this build published, newest number last.
 *
 * why a copy of the new version rather than a move of the old one: by the time
 * the build runs, the file on disk already carries the author's latest edits —
 * moving it would file the *new* text under the old version's name. Every build
 * therefore appends what it just wrote, and `index.html` mirrors the newest
 * entry. An unchanged rebuild adds nothing, so the folder stays a record of
 * versions rather than of commands.
 *
 * Returns the path kept, or null when this version is already the newest one.
 */
async function keepVersion(outputPath: string, built: string): Promise<string | null> {
  const folder = join(dirname(outputPath), HISTORY_DIRECTORY);
  await mkdir(folder, { recursive: true });

  const kept = (await readdir(folder).catch(() => [] as string[]))
    .filter((entry) => /^\d{4}-/.test(entry))
    .sort();

  const newest = kept.at(-1);
  if (newest !== undefined) {
    const previous = await readFile(join(folder, newest), 'utf8').catch(() => null);
    if (previous === built) return null;
  }

  const sequence = String(kept.length + 1).padStart(4, '0');
  const day = new Date().toISOString().slice(0, 10);
  const archived = join(folder, `${sequence}-${day}.html`);

  await writeFile(archived, built, 'utf8');
  return archived;
}

// ─────────────────────────────────────────────────────────────────────────────
// validate
// ─────────────────────────────────────────────────────────────────────────────

async function runValidate(parsed: ParsedArguments): Promise<number> {
  const inputPath = parsed.positionals[0];
  if (!inputPath) {
    process.stderr.write(`forgedoc validate: expected a file.\n\n${USAGE}`);
    return 1;
  }

  const source = await readSource(inputPath);
  if (source === null) return 1;

  const result = validateHtml(source, {
    file: inputPath,
    expectBuilt: parsed.flags.get('built') === true,
  });

  const isJson = parsed.flags.get('format') === 'json';
  if (isJson) {
    process.stdout.write(`${formatJson(result)}\n`);
  } else {
    process.stdout.write(`${formatText(result)}\n`);
  }

  return result.ok ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// new
// ─────────────────────────────────────────────────────────────────────────────

async function runNew(parsed: ParsedArguments): Promise<number> {
  const name = parsed.positionals[0];
  if (!name) {
    process.stderr.write(`forgedoc new: expected a name.\n\n${USAGE}`);
    return 1;
  }

  const docId = slugify(name);
  const directoryFlag = parsed.flags.get('dir');
  const directory = typeof directoryFlag === 'string' ? directoryFlag : '.';
  const outputPath = join(directory, `DOC_${docId}.html`);

  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, skeleton(name, docId), 'utf8');

  process.stdout.write(
    `forgedoc new: wrote ${outputPath}\n  next: edit it, then run \`forgedoc build ${outputPath}\`\n`,
  );
  return 0;
}

/**
 * The starting document: the shell, and nothing else.
 *
 * The two placeholders sit where their replacements belong: the styles in
 * `<head>`, so the reader never sees a frame of unstyled markup, and the script
 * at the end of `<body>`, so elements upgrade once, after parse, with every
 * child present (§5.2). `injectAssets` hoists a body-end `<style>` anyway — a
 * document written before this shape still builds correctly — but the skeleton
 * is what agents copy, so it should not need the rescue.
 *
 * `<doc-page>` is the whole body because it is what carries the feedback bucket;
 * everything inside it is the author's. why no starting sections, chips or
 * question: a scaffold is copied, so whatever it contains becomes the shape of
 * every document written from it. A plan should take the shape of the problem it
 * describes, and an empty page is the only scaffold that imposes none.
 */
function skeleton(title: string, docId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>/*@DOC_CSS@*/</style>
</head>
<body>

<doc-page doc-id="${docId}">

</doc-page>

<script>//@DOC_JS@</script>
</body>
</html>
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// elements / info / cheatsheet / search / reference / themes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The vocabulary, one line per element.
 *
 * Text output is markdown on purpose: an agent pipes it straight into its own
 * context, and a human reads the same bytes in a terminal without a renderer.
 */
function runElements(parsed: ParsedArguments): number {
  const categoryFlag = parsed.flags.get('category');
  const category = typeof categoryFlag === 'string' ? categoryFlag : undefined;

  if (isJson(parsed)) {
    writeJson(elementsJson(category));
    return 0;
  }

  process.stdout.write(renderElements(category));
  return 0;
}

/** Everything about one element: attributes, parts, states, nesting, example. */
function runInfo(parsed: ParsedArguments): number {
  const query = parsed.positionals[0];
  if (!query) {
    process.stderr.write(
      'forgedoc info: expected an element name, e.g. `forgedoc info doc-choice`.\n' +
        '    `forgedoc elements` lists them; `forgedoc search <word>` finds one by what it does.\n',
    );
    return 1;
  }

  const tag = normaliseTag(query);
  if (!isKnownTag(tag)) {
    process.stderr.write(unknownElementMessage(query));
    return 1;
  }

  if (isJson(parsed)) {
    writeJson({
      ...elementDetail(tag),
      globalAttributes: globalAttributesJson(),
    });
    return 0;
  }

  process.stdout.write(renderInfo(tag));
  return 0;
}

/**
 * A near-miss is the common case — `doc-tab` for `doc-tabs`, `note` for
 * `doc-note` — so spend the error message on candidates rather than on repeating
 * what the user typed.
 */
function unknownElementMessage(query: string): string {
  const suggestions = suggestTags(query);
  const lines = [`forgedoc info: there is no element called "${query}".`];

  if (suggestions.length > 0) {
    lines.push(`    Did you mean: ${suggestions.map((tag) => `<${tag}>`).join(', ')}?`);
  }
  lines.push('    `forgedoc elements` lists every element.');

  return `${lines.join('\n')}\n`;
}

/** The whole vocabulary on one page — the thing to keep open while authoring. */
function runCheatsheet(parsed: ParsedArguments): number {
  if (isJson(parsed)) {
    writeJson(elementsJson());
    return 0;
  }

  process.stdout.write(renderCheatsheet());
  return 0;
}

/** Find an element by what it does, for when the tag name is not yet known. */
function runSearch(parsed: ParsedArguments): number {
  const query = parsed.positionals.join(' ').trim();
  if (!query) {
    process.stderr.write(
      'forgedoc search: expected something to search for, e.g. `forgedoc search http endpoint`.\n',
    );
    return 1;
  }

  const hits = searchDocs(query);
  if (isJson(parsed)) {
    writeJson({ query, hits });
    // why 0 rather than 1 on an empty result: "no element does that" is a valid
    // answer to a valid question, and a harness reads the array, not the code.
    return 0;
  }

  process.stdout.write(renderSearch(query));
  return hits.length > 0 ? 0 : 1;
}

/** Every element in full, plus the styling and ARIA rules that span all of them. */
function runReference(parsed: ParsedArguments): number {
  if (isJson(parsed)) {
    writeJson({
      globalAttributes: globalAttributesJson(),
      ...(elementsJson() as Record<string, unknown>),
      elements: elementSummaries().map((summary) => elementDetail(summary.tag)),
    });
    return 0;
  }

  process.stdout.write(renderReference());
  return 0;
}

/** The themes this installation can build with, named rather than guessed at. */
async function runThemes(parsed: ParsedArguments): Promise<number> {
  const themes = await availableThemes(DIST_DIR);

  if (themes === null) {
    const message = `no ${DIST_DIR}/themes — run \`npm run build\` first`;
    if (isJson(parsed)) {
      writeJson({ themes: [], default: DEFAULT_THEME, error: message });
      return 1;
    }
    process.stderr.write(`forgedoc themes: ${message}.\n`);
    return 1;
  }

  if (isJson(parsed)) {
    writeJson({ themes, default: DEFAULT_THEME });
    return 0;
  }

  const lines = themes.map((theme) => `  ${theme}${theme === DEFAULT_THEME ? '  (default)' : ''}`);
  process.stdout.write(
    `${lines.join('\n')}\n\n` +
      'Pick one with `forgedoc build <file> --theme <name>`, or name it in the document:\n' +
      '  <style>/*@DOC_CSS:<name>@*/</style>\n',
  );
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// version
// ─────────────────────────────────────────────────────────────────────────────

async function runVersion(parsed: ParsedArguments): Promise<number> {
  const metadata = await readPackageMetadata();
  if (parsed.flags.get('format') === 'json') {
    process.stdout.write(JSON.stringify(metadata, null, 2));
  } else {
    process.stdout.write(`${metadata.version}\n`);
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isJson = (parsed: ParsedArguments): boolean => parsed.flags.get('format') === 'json';

function writeJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function readSource(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`forgedoc: cannot read ${path}: ${message}\n`);
    return null;
  }
}

async function readPackageMetadata(): Promise<{ name: string; version: string }> {
  try {
    const text = await readFile(join(HERE, '../package.json'), 'utf8');
    const parsed = JSON.parse(text) as { name?: string; version?: string };
    return {
      name: parsed.name ?? 'forgedoc',
      version: parsed.version ?? '0.0.0',
    };
  } catch {
    return { name: 'forgedoc', version: '0.0.0' };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const USAGE = `Usage: forgedoc <command> [options]

Authoring:
  forgedoc new <name>            Scaffold an empty document shell
    --dir=<path>                 Target directory (default: current directory)

  forgedoc build <file.html>     Build the document in place — one file, rebuilt
    --history                    Keep superseded versions in <name>/history/
    --offline                    Embed everything (Mermaid included) for file:// opening
    --theme=<name>               Theme to apply (see \`forgedoc themes\`)
    --out=<file.html>            Write somewhere else (default: .temp/ for offline)
    --no-validate                Skip validation before building

  forgedoc validate <file.html>  Check a document against the markup contract
    --format=json                Machine-readable output for agent harnesses
    --built                      Verify the file is a finished build (no placeholders)

Documentation — every element, generated from the same contract the validator
enforces, so nothing here can describe markup that fails the build:

  forgedoc cheatsheet            The whole vocabulary on one page
  forgedoc elements              One line per element
    --category=<name>            Limit to one group (Shell, Interactive, Content, …)
  forgedoc info <element>        Attributes, parts, states, nesting and an example
  forgedoc search <words>        Find an element by what it does
  forgedoc reference             Every element in full, plus the styling rules
  forgedoc themes                Themes this installation can build with

  Each accepts --format=json.

  forgedoc version               Print the package version
  forgedoc help                  Show this message
`;
