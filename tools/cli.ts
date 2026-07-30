/**
 * `plankit build | validate | new | version`
 *
 * The authoring agent's whole toolchain: write markup, run one command (§2.4).
 * Every path exits non-zero on any validation error so an agent harness can
 * branch on the exit code alone.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import process from 'node:process';
import { slugify } from '../src/core/slug.js';
import {
  type BundleFlavour,
  InjectionError,
  injectAssets,
  resolveAssets,
  usesMermaid,
} from './inject.js';
import { formatJson, formatText, validateHtml } from './validate.js';

declare const __PLANKIT_VERSION__: string;
const VERSION = typeof __PLANKIT_VERSION__ === 'string' ? __PLANKIT_VERSION__ : '0.0.0-dev';

const USAGE = `plankit ${VERSION}

  plankit build <file.html> [--out <file>] [--offline] [--no-validate]
      Validate, then wire the runtime into the placeholders.
      Default: link a version-pinned CDN. The document stays a few kB and is
      safe to commit.
      --offline embeds the whole runtime instead, for a file:// document that
      never touches the network. Large — it defaults to writing into .temp/,
      which you should gitignore rather than commit.

  plankit validate <file.html> [--format=json] [--built]
      Check the markup contract. Exits non-zero on any error.

  plankit new <name> [--dir <path>]
      Scaffold PLAN_<name>.html with the required skeleton.

  plankit version
`;

interface ParsedArguments {
  readonly command: string;
  readonly positionals: readonly string[];
  readonly flags: ReadonlyMap<string, string | true>;
}

/** Entry point. Resolves to the process exit code. */
export async function run(argv: readonly string[]): Promise<number> {
  const parsed = parseArguments(argv);

  switch (parsed.command) {
    case 'build':
      return runBuild(parsed);
    case 'validate':
      return runValidate(parsed);
    case 'new':
      return runNew(parsed);
    case 'version':
    case '--version':
    case '-v':
      process.stdout.write(`${VERSION}\n`);
      return 0;
    case 'help':
    case '--help':
    case '-h':
    case '':
      process.stdout.write(USAGE);
      return parsed.command === '' ? 1 : 0;
    default:
      process.stderr.write(`plankit: unknown command \`${parsed.command}\`\n\n${USAGE}`);
      return 1;
  }
}

function parseArguments(argv: readonly string[]): ParsedArguments {
  const [command = '', ...rest] = argv;
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

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

const VALUE_FLAGS = new Set(['out', 'dir', 'format']);

// ─────────────────────────────────────────────────────────────────────────────
// build
// ─────────────────────────────────────────────────────────────────────────────

async function runBuild(parsed: ParsedArguments): Promise<number> {
  const inputPath = parsed.positionals[0];
  if (!inputPath) {
    process.stderr.write(`plankit build: expected a file.\n\n${USAGE}`);
    return 1;
  }

  const source = await readSource(inputPath);
  if (source === null) return 1;

  if (parsed.flags.get('no-validate') !== true) {
    const result = validateHtml(source, { file: inputPath });
    process.stderr.write(`${formatText(result)}\n`);
    if (!result.ok) {
      process.stderr.write('\nplankit build: no output written.\n');
      return 1;
    }
  }

  // why: a plan is text and belongs in git as text. The CDN flavour keeps it
  // that way and rides an immutable cache; embedding is the exception you ask
  // for when the document has to survive with no network at all.
  const flavour: BundleFlavour = parsed.flags.get('offline') === true ? 'offline' : 'cdn';

  let output: string;
  try {
    const assets = await resolveAssets(flavour);
    output = injectAssets(source, assets);
  } catch (error) {
    reportInjectionError(error);
    return 1;
  }

  // MUST (§11.2): confirm the placeholders really went away before writing.
  const builtCheck = validateHtml(output, { file: inputPath, expectBuilt: true });
  const placeholderErrors = builtCheck.diagnostics.filter(
    (diagnostic) => diagnostic.ruleId === 'build/unreplaced-placeholder',
  );
  if (placeholderErrors.length > 0) {
    process.stderr.write(`${formatText({ ...builtCheck, diagnostics: placeholderErrors })}\n`);
    return 1;
  }

  const outputPath = resolveOutputPath(inputPath, parsed.flags.get('out'), flavour);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, 'utf8');

  const kilobytes = Math.round(Buffer.byteLength(output, 'utf8') / 1024);
  process.stdout.write(`plankit build: wrote ${outputPath} (${kilobytes} kB, ${flavour})\n`);
  if (flavour === 'offline') warnAboutOfflineWeight(source, kilobytes, parsed.flags.get('out'));
  return 0;
}

/**
 * Say plainly why an offline document is heavy, and where it should not go.
 *
 * The Mermaid check is the whole story: without a Mermaid figure the embedded
 * runtime is ~160 kB and unremarkable; with one it is ~3.5 MB, because the IIFE
 * cannot code-split and so carries every Mermaid diagram type at once.
 */
function warnAboutOfflineWeight(
  source: string,
  kilobytes: number,
  outFlag: string | true | undefined,
): void {
  if (usesMermaid(source)) {
    process.stderr.write(
      `\nplankit build: this document embeds Mermaid, which is most of the ${kilobytes} kB.\n` +
        '    Mermaid ships every diagram type in one file because an IIFE cannot code-split.\n' +
        '    A plan with no `<plan-figure type="mermaid">` embeds roughly 160 kB instead.\n',
    );
  }

  if (typeof outFlag === 'string') return;
  process.stderr.write(
    `    Do not commit this file — add \`${TEMP_DIRECTORY}/\` to .gitignore and send it directly.\n` +
      '    The committed plan should be the CDN build: `plankit build <file.html>`.\n',
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
    process.stderr.write(`plankit validate: expected a file.\n\n${USAGE}`);
    return 1;
  }

  const source = await readSource(inputPath);
  if (source === null) return 1;

  const result = validateHtml(source, {
    file: inputPath,
    expectBuilt: parsed.flags.get('built') === true,
  });

  const asJson = parsed.flags.get('format') === 'json';
  process.stdout.write(`${asJson ? formatJson(result) : formatText(result)}\n`);
  return result.ok ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// new
// ─────────────────────────────────────────────────────────────────────────────

async function runNew(parsed: ParsedArguments): Promise<number> {
  const name = parsed.positionals[0];
  if (!name) {
    process.stderr.write(`plankit new: expected a name.\n\n${USAGE}`);
    return 1;
  }

  const planId = slugify(name);
  const directoryFlag = parsed.flags.get('dir');
  const directory = typeof directoryFlag === 'string' ? directoryFlag : '.';
  const outputPath = join(directory, `PLAN_${planId}.html`);

  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, skeleton(name, planId), 'utf8');

  process.stdout.write(
    `plankit new: wrote ${outputPath}\n  next: edit it, then run \`plankit build ${outputPath}\`\n`,
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
function skeleton(title: string, planId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>/*@PLAN_CSS@*/</style>
</head>
<body>

<plan-doc plan-id="${planId}" density="comfortable" accent="teal">

  <plan-header kicker="Plan">
    ${escapeHtml(title)}
    <p slot="lede">One or two sentences on what this plan is for and who reads it.</p>
  </plan-header>

  <plan-chips>
    <plan-chip kind="action">Answer the questions inline, then send the bucket back</plan-chip>
  </plan-chips>

  <plan-section title="What we are building">
    <p>Replace this with the shape of the work.</p>
  </plan-section>

  <plan-section title="Open questions">
    <plan-choice mode="single" question="Replace this with a real decision you need made">
      <plan-option recommended>
        First answer
        <p slot="desc">Why this one is the recommendation.</p>
      </plan-option>
      <plan-option>
        Second answer
        <p slot="desc">What it costs instead.</p>
      </plan-option>
    </plan-choice>
  </plan-section>

</plan-doc>

<script>//@PLAN_JS@</script>
</body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

async function readSource(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    process.stderr.write(`plankit: cannot read ${path}\n`);
    return null;
  }
}

function reportInjectionError(error: unknown): void {
  if (error instanceof InjectionError) {
    process.stderr.write(`plankit build: ${error.message}\n    fix: ${error.fix}\n`);
    return;
  }
  process.stderr.write(`plankit build: ${String(error)}\n`);
}
