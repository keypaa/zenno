const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { isRepoWorthGraphing } = require('./repo-worth-graphing');

function generateGraph(repoRoot, outputDir) {
  if (!isRepoWorthGraphing(repoRoot)) {
    return { generated: false, reason: 'repo-too-small', tagCount: 0, path: null };
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tagsPath = path.join(outputDir, 'tags');

  // Known footgun (confirmed empirically during tool benchmarking): a
  // trailing slash on the target directory argument silently produces
  // zero tags with exit code 0 — no error at all. path.join never
  // produces a trailing slash, so this is structurally avoided rather
  // than just documented.
  const target = repoRoot;

  execFileSync(
    'ctags',
    ['-f', tagsPath, '-R', '--exclude=.git', '--exclude=node_modules', '--exclude=zenno', target],
    { stdio: 'ignore' }
  );

  if (!fs.existsSync(tagsPath)) {
    return { generated: false, reason: 'ctags-produced-no-output', tagCount: 0, path: null };
  }

  const content = fs.readFileSync(tagsPath, 'utf8');
  const tagCount = content
    .split('\n')
    .filter((line) => line.length > 0 && !line.startsWith('!_TAG_')).length;

  return { generated: true, reason: null, tagCount, path: tagsPath };
}

module.exports = { generateGraph };
