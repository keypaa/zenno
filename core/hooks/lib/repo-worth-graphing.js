const fs = require('node:fs');
const path = require('node:path');

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'zenno']);
const MIN_FILES_TO_GRAPH = 3;

function countSourceFiles(dir, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return 0;

  let count = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      count += countSourceFiles(path.join(dir, entry.name), depth + 1, maxDepth);
    } else if (entry.isFile()) {
      count += 1;
    }
    if (count >= MIN_FILES_TO_GRAPH) return count; // early exit, no need to keep scanning a large repo just to prove it's non-empty
  }

  return count;
}

function isRepoWorthGraphing(repoRoot) {
  return countSourceFiles(repoRoot) >= MIN_FILES_TO_GRAPH;
}

module.exports = { isRepoWorthGraphing, countSourceFiles, MIN_FILES_TO_GRAPH };
