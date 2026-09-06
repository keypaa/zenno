#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runBootstrap } = require('./bootstrap');

// Claude Code's SessionStart hooks receive a JSON payload on stdin that
// includes, among other fields, the session's cwd. We read stdin
// synchronously (fd 0) since hook processes are short-lived and this
// must complete before Claude Code proceeds.
function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ASSUMPTION, NOT YET EMPIRICALLY VERIFIED — see task note above.
function deriveProjectMemoryDir(repoPath, homeDir) {
  const slug = repoPath
    .replace(/^[A-Za-z]:/, '') // strip Windows drive letter, e.g. "C:"
    .split(/[\\/]/) // split on both Windows (\) and POSIX (/) separators,
    // regardless of which platform this code is actually running on
    .filter(Boolean)
    .join('-');
  return path.join(homeDir, '.claude', 'projects', `-${slug}`, 'memory');
}

function main() {
  const payload = readStdinJson();
  const targetRepoRoot = payload.cwd || process.cwd();
  const homeDir = os.homedir();
  const memoryDir = deriveProjectMemoryDir(targetRepoRoot, homeDir);

  const result = runBootstrap({ targetRepoRoot, homeDir, memoryDir });

  if (result.ranBootstrap) {
    process.stderr.write('Zenno: first-run bootstrap complete.\n');
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { deriveProjectMemoryDir, readStdinJson, main };
