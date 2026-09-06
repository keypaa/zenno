#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { isRepoWorthGraphing } = require('./repo-worth-graphing');
const { checkGraphStaleness } = require('./check-graph-staleness');

function checkAndNudge(repoRoot) {
  if (!isRepoWorthGraphing(repoRoot)) {
    return { nudged: false, reason: 'repo-too-small' };
  }

  const outputDir = path.join(repoRoot, 'zenno', 'graph');
  const staleness = checkGraphStaleness(repoRoot, outputDir);

  if (!staleness.stale) {
    return { nudged: false, reason: staleness.reason };
  }

  return { nudged: true, staleness };
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function main() {
  const payload = readStdinJson();
  const repoRoot = payload.cwd || process.cwd();
  const result = checkAndNudge(repoRoot);

  if (result.nudged) {
    const detail =
      result.staleness.reason === 'never-generated'
        ? 'no graph has been generated yet'
        : `${result.staleness.commitsBehind} commit(s) behind`;
    process.stderr.write(
      `Zenno: repo graph is stale (${detail}). Run the graph-generation skill to refresh it.\n`
    );
  }

  // This hook only ever informs — it never blocks SessionStart, regardless
  // of staleness state, per the design spec's "prompt regeneration without
  // forcing it automatically."
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { checkAndNudge };
