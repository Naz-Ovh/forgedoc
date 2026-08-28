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

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { slugify } from '../src/core/slug.js';
import {
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
export type Command = 'build' | 'validate' | 'new' | 'version' | 'help';

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

  const knownCommands = new Set<Command>(['build', 'validate', 'new', 'version', 'help']);
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

const VALUE_FLAGS = new Set(['out', 'dir', 'format', 'theme']);

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
  const outputPath = resolveOutputPath(inputPath, outFlag, flavour);

  const built = injectAssets(source, assets);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, built, 'utf8');

  const kilobytes = Math.round(Buffer.byteLength(built, 'utf8') / 1024);
  const themeLabel = theme ? `, theme "${theme}"` : '';
  process.stdout.write(
    `forgedoc build: wrote ${outputPath} (${kilobytes} kB, ${flavour}${themeLabel})\n`,
  );

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

function resolveOutputPath(
  inputPath: string,
  outFlag: string | true | undefined,
  flavour: BundleFlavour,
): string {
  if (typeof outFlag === 'string') return outFlag;

  const extension = extname(inputPath) || '.html';
  const stem = basename(inputPath, extension);

  // why: an embedded document is a build artefact, not a source file. Defaulting
  // it beside the input is what gets a 3.5 MB blob committed by accident.
  if (flavour === 'offline') {
    return join(dirname(inputPath), TEMP_DIRECTORY, `${stem}${extension}`);
  }
  return join(dirname(inputPath), `${stem}.built${extension}`);
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
 * The starting document — and the placeholder contract in its canonical shape.
 *
 * The two placeholders sit where their replacements belong: the styles in
 * `<head>`, so the reader never sees a frame of unstyled markup, and the script
 * at the end of `<body>`, so elements upgrade once, after parse, with every
 * child present (§5.2). `injectAssets` hoists a body-end `<style>` anyway — a
 * document written before this shape still builds correctly — but the skeleton
 * is what agents copy, so it should not need the rescue.
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

<doc-page doc-id="${docId}" density="comfortable" accent="teal">

  <doc-header kicker="Plan">
    ${escapeHtml(title)}
    <p slot="lede">One or two sentences on what this plan is for and who reads it.</p>
  </doc-header>

  <doc-chips>
    <doc-chip kind="neutral">Answer the questions inline, then send the bucket back</doc-chip>
  </doc-chips>

  <doc-section title="What we are building">
    <p>Replace this with the shape of the work.</p>
  </doc-section>

  <doc-section title="Open questions">
    <doc-choice mode="single" question="Replace this with a real decision you need made">
      <doc-option recommended>
        Option A (recommended)
        <p slot="desc">Why this is the right default.</p>
      </doc-option>
      <doc-option>
        Option B
        <p slot="desc">The trade-off this path makes.</p>
      </doc-option>
      <doc-option other>
        Something else
        <p slot="desc">Describe an alternative.</p>
      </doc-option>
    </doc-choice>
  </doc-section>

</doc-page>

<script>//@DOC_JS@</script>
</body>
</html>
`;
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

Commands:
  forgedoc build <file.html>     Inject runtime assets into a plan document
    --offline                    Embed everything (Mermaid included) for file:// opening
    --theme=<name>               Theme to apply: forgedoc (default), geist
    --out=<file.html>            Output file path (default: .temp/<file>.html for offline)
    --no-validate                Skip validation before building

  forgedoc validate <file.html>  Check a plan against the markup contract
    --format=json                Machine-readable output for agent harnesses
    --built                      Verify the file is a finished build (no placeholders)

  forgedoc new <name>            Scaffold a valid starting document
    --dir=<path>                 Target directory (default: current directory)

  forgedoc version               Print the package version
  forgedoc help                  Show this message
`;
