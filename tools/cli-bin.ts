/**
 * Executable wrapper around `run()`.
 *
 * why: keeping process wiring out of `cli.ts` means the command implementations
 * stay directly importable from tests without spawning a subprocess.
 */

import process from 'node:process';

import { run } from './cli.js';

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`forgedoc: ${String(error)}\n`);
    process.exitCode = 1;
  });
