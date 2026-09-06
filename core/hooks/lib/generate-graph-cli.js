#!/usr/bin/env node
const path = require('node:path');
const { generateGraph } = require('./generate-graph');
const { writeGraphMetadata } = require('./graph-metadata');

function runGraphGeneration(repoRoot) {
  const outputDir = path.join(repoRoot, 'zenno', 'graph');
  const result = generateGraph(repoRoot, outputDir);

  if (!result.generated) {
    return result;
  }

  const meta = writeGraphMetadata(repoRoot, outputDir);
  return { ...result, meta };
}

function main() {
  const repoRoot = process.argv[2] || process.cwd();
  let result;
  try {
    result = runGraphGeneration(repoRoot);
  } catch (err) {
    // Most commonly: ctags isn't installed/on PATH. An uncaught exception
    // here would otherwise dump a raw Node stack trace — a bad experience
    // for what's meant to be an expected, gracefully-handled case (missing
    // an optional external tool), not a crash-worthy one.
    if (err.code === 'ENOENT') {
      process.stderr.write(
        'Zenno: ctags is not installed or not on PATH. Install Universal ' +
          'Ctags to enable repo graph generation (see design spec Section 5).\n'
      );
      process.exit(0);
    }
    process.stderr.write(`Zenno: graph generation failed unexpectedly: ${err.message}\n`);
    process.exit(1);
  }

  if (!result.generated) {
    process.stdout.write(`Zenno: graph not generated (${result.reason}).\n`);
    process.exit(0);
  }

  process.stdout.write(
    `Zenno: graph generated — ${result.tagCount} symbols indexed, written to ${result.path}\n`
  );
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { runGraphGeneration };
