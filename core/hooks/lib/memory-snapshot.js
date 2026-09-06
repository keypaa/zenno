const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { snapshotsDir, semanticDir, ensureMemoryDirs } = require('./memory-paths');
function initSnapshotRepo(memoryDir) {
  ensureMemoryDirs(memoryDir);
  const dir = snapshotsDir(memoryDir);
  const gitDir = path.join(dir, '.git');
  if (fs.existsSync(gitDir)) return { path: dir, initialized: false };
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', '--local', 'user.name', 'Zenno Memory'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', '--local', 'user.email', 'zenno-memory@localhost'], { cwd: dir, stdio: 'ignore' });
  return { path: dir, initialized: true };
}
function commitSnapshot(memoryDir, message) {
  initSnapshotRepo(memoryDir);
  const dir = snapshotsDir(memoryDir);
  const src = path.join(semanticDir(memoryDir), 'facts.jsonl');
  const dest = path.join(dir, 'facts.jsonl');
  const content = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : '';
  fs.writeFileSync(dest, content, 'utf8');
  execFileSync('git', ['add', 'facts.jsonl'], { cwd: dir, stdio: 'ignore' });
  try {
    execFileSync('git', ['commit', '-m', message], { cwd: dir, stdio: 'ignore' });
  } catch {
    return { committed: false, commitHash: null };
  }
  const hash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  return { committed: true, commitHash: hash };
}
function listSnapshots(memoryDir) {
  const dir = snapshotsDir(memoryDir);
  const gitDir = path.join(dir, '.git');
  if (!fs.existsSync(gitDir)) return [];
  let log;
  try {
    log = execFileSync('git', ['log', '--format=%H|%ci|%s'], { cwd: dir, encoding: 'utf8' }).trim();
  } catch { return []; }
  if (!log) return [];
  return log.split('\n').map((line) => {
    const [hash, date, message] = line.split('|');
    return { hash, date, message };
  });
}
module.exports = { initSnapshotRepo, commitSnapshot, listSnapshots };
