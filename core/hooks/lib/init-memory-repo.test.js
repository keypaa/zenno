const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { initMemorySnapshotRepo } = require('./init-memory-repo');

function makeTempMemoryDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-memory-test-'));
}

test('creates the snapshots folder and a real git repo inside it', () => {
  const memoryDir = makeTempMemoryDir();
  const result = initMemorySnapshotRepo(memoryDir);

  assert.equal(result.initialized, true);
  assert.ok(fs.existsSync(path.join(result.path, '.git')));
});

test('the initialized repo can actually accept a commit (real git, not a stub)', () => {
  const memoryDir = makeTempMemoryDir();
  const result = initMemorySnapshotRepo(memoryDir);

  fs.writeFileSync(path.join(result.path, 'test-snapshot.json'), '{}');
  execFileSync('git', ['add', 'test-snapshot.json'], { cwd: result.path });
  execFileSync('git', ['commit', '-m', 'snapshot #1'], { cwd: result.path });

  const log = execFileSync('git', ['log', '--oneline'], {
    cwd: result.path,
    encoding: 'utf8',
  });
  assert.match(log, /snapshot #1/);
});

test('is idempotent — does not re-init an already-initialized repo', () => {
  const memoryDir = makeTempMemoryDir();
  initMemorySnapshotRepo(memoryDir);
  const second = initMemorySnapshotRepo(memoryDir);

  assert.equal(second.initialized, false);
});
