const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function getCurrentCommit(repoRoot) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return null; // not a git repo, or no commits yet
  }
}

function writeGraphMetadata(repoRoot, outputDir) {
  // Self-contained and defensive, matching the pattern used elsewhere
  // (e.g. the audit journal writer in a later plan): create outputDir if
  // it doesn't already exist, rather than assuming a caller always
  // creates it first. In the normal flow (via the CLI in Task 5) it
  // already exists by the time this runs, but this module shouldn't
  // silently depend on that.
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const metaPath = path.join(outputDir, '.meta.json');
  const meta = {
    generatedAtCommit: getCurrentCommit(repoRoot),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return meta;
}

function readGraphMetadata(outputDir) {
  const metaPath = path.join(outputDir, '.meta.json');
  if (!fs.existsSync(metaPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
}

module.exports = { writeGraphMetadata, readGraphMetadata, getCurrentCommit };
