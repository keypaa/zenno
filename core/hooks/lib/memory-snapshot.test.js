const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initSnapshotRepo, commitSnapshot, listSnapshots } = require('./memory-snapshot');
const { appendSemanticFact } = require('./semantic-memory');
function makeTempMemoryDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-snapshot-test-')); }
test('initSnapshotRepo creates a real git repo', () => {
  const dir = makeTempMemoryDir();
  const result = initSnapshotRepo(dir);
  assert.equal(result.initialized, true);
  assert.ok(fs.existsSync(path.join(result.path, '.git')));
});
test('initSnapshotRepo is idempotent', () => {
  const dir = makeTempMemoryDir();
  initSnapshotRepo(dir);
  const second = initSnapshotRepo(dir);
  assert.equal(second.initialized, false);
});
test('commitSnapshot copies the current semantic facts and commits them', () => {
  const dir = makeTempMemoryDir();
  appendSemanticFact(dir, { text: 'fact one' });
  const result = commitSnapshot(dir, 'snapshot #1');
  assert.equal(result.committed, true);
  assert.ok(result.commitHash);
  const snapshots = listSnapshots(dir);
  assert.equal(snapshots.length, 1);
  assert.match(snapshots[0].message, /snapshot #1/);
});
test('commitSnapshot is a no-op (committed: false) when nothing changed', () => {
  const dir = makeTempMemoryDir();
  appendSemanticFact(dir, { text: 'fact one' });
  commitSnapshot(dir, 'first');
  const second = commitSnapshot(dir, 'second attempt, no new facts');
  assert.equal(second.committed, false);
});
test('listSnapshots returns empty array before any snapshot is taken', () => {
  const dir = makeTempMemoryDir();
  assert.deepEqual(listSnapshots(dir), []);
});
