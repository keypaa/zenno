const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readGraphMetadata, getCurrentCommit } = require('./graph-metadata');

function countCommitsBetween(repoRoot, fromCommit, toCommit) {
  try {
    const output = execFileSync(
      'git',
      ['rev-list', '--count', `${fromCommit}..${toCommit}`],
      { cwd: repoRoot, encoding: 'utf8' }
    ).trim();
    return parseInt(output, 10);
  } catch {
    return null; // fromCommit no longer reachable (e.g. history rewritten)
  }
}

function checkGraphStaleness(repoRoot, outputDir) {
  const meta = readGraphMetadata(outputDir);
  if (meta === null) {
    return { stale: true, commitsBehind: null, reason: 'never-generated' };
  }

  const currentCommit = getCurrentCommit(repoRoot);
  if (currentCommit === null) {
    return { stale: false, commitsBehind: 0, reason: 'not-a-git-repo' };
  }

  if (currentCommit === meta.generatedAtCommit) {
    return { stale: false, commitsBehind: 0, reason: 'up-to-date' };
  }

  const commitsBehind = countCommitsBetween(
    repoRoot,
    meta.generatedAtCommit,
    currentCommit
  );

  if (commitsBehind === null) {
    return { stale: true, commitsBehind: null, reason: 'history-diverged' };
  }

  return {
    stale: commitsBehind > 0,
    commitsBehind,
    reason: commitsBehind > 0 ? 'commits-since-last-generation' : 'up-to-date',
  };
}

module.exports = { checkGraphStaleness, countCommitsBetween };
