const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { episodicDir, semanticDir, workingDir, snapshotsDir, ensureMemoryDirs } = require('./memory-paths');
function makeTempMemoryDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-mempaths-test-')); }
test('computes the four expected subdirectory paths under zenno/', () => {
  const dir = makeTempMemoryDir();
  assert.equal(episodicDir(dir), path.join(dir, 'zenno', 'episodic'));
  assert.equal(semanticDir(dir), path.join(dir, 'zenno', 'semantic'));
  assert.equal(workingDir(dir), path.join(dir, 'zenno', 'working'));
  assert.equal(snapshotsDir(dir), path.join(dir, 'zenno', 'snapshots'));
});
test('ensureMemoryDirs creates all four subdirectories', () => {
  const dir = makeTempMemoryDir();
  ensureMemoryDirs(dir);
  assert.ok(fs.existsSync(episodicDir(dir)));
  assert.ok(fs.existsSync(semanticDir(dir)));
  assert.ok(fs.existsSync(workingDir(dir)));
  assert.ok(fs.existsSync(snapshotsDir(dir)));
});
test('ensureMemoryDirs is idempotent', () => {
  const dir = makeTempMemoryDir();
  ensureMemoryDirs(dir);
  assert.doesNotThrow(() => ensureMemoryDirs(dir));
});
