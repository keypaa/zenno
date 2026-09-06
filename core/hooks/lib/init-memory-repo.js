const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function initMemorySnapshotRepo(memoryDir) {
  const snapshotsPath = path.join(memoryDir, 'zenno', 'snapshots');

  if (!fs.existsSync(snapshotsPath)) {
    fs.mkdirSync(snapshotsPath, { recursive: true });
  }

  const gitDir = path.join(snapshotsPath, '.git');
  if (fs.existsSync(gitDir)) {
    return { path: snapshotsPath, initialized: false };
  }

  execFileSync('git', ['init'], { cwd: snapshotsPath, stdio: 'ignore' });
  // Local-only identity so commits succeed even without global git config —
  // this repo is private plumbing, never pushed, never authored by a human.
  execFileSync('git', ['config', '--local', 'user.name', 'Zenno Memory'], {
    cwd: snapshotsPath,
    stdio: 'ignore',
  });
  execFileSync(
    'git',
    ['config', '--local', 'user.email', 'zenno-memory@localhost'],
    { cwd: snapshotsPath, stdio: 'ignore' }
  );

  return { path: snapshotsPath, initialized: true };
}

module.exports = { initMemorySnapshotRepo };
