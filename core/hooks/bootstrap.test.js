const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runBootstrap } = require('./bootstrap');

function makeTempDirs() {
  const targetRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-bootstrap-repo-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-bootstrap-home-'));
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-bootstrap-memory-'));
  return { targetRepoRoot, homeDir, memoryDir };
}

test('runs full bootstrap on first call and writes the marker', () => {
  const dirs = makeTempDirs();
  const result = runBootstrap(dirs);

  assert.equal(result.ranBootstrap, true);
  assert.ok(fs.existsSync(path.join(dirs.targetRepoRoot, 'zenno', '.initialized')));
  assert.ok(fs.existsSync(path.join(dirs.targetRepoRoot, 'zenno', 'config.json')));
  assert.ok(fs.existsSync(path.join(dirs.homeDir, '.claude', 'settings.json')));
  assert.ok(fs.existsSync(path.join(dirs.targetRepoRoot, 'CLAUDE.md')));
  assert.ok(
    fs.existsSync(path.join(dirs.memoryDir, 'zenno', 'snapshots', '.git'))
  );
});

test('is a no-op on the second call — marker prevents re-running', () => {
  const dirs = makeTempDirs();
  runBootstrap(dirs);

  // Prove it's a real no-op, not just idempotent writes: delete config.json
  // after first bootstrap, then run again. If bootstrap actually re-ran,
  // config.json would reappear. It must not.
  fs.rmSync(path.join(dirs.targetRepoRoot, 'zenno', 'config.json'));
  const second = runBootstrap(dirs);

  assert.equal(second.ranBootstrap, false);
  assert.equal(second.results, null);
  assert.equal(
    fs.existsSync(path.join(dirs.targetRepoRoot, 'zenno', 'config.json')),
    false
  );
});

test('does not write the marker if a step fails partway through — safe to retry', () => {
  const dirs = makeTempDirs();
  // Force scaffoldFolders (the first step) to fail: point targetRepoRoot at
  // a path that is a FILE, not a directory, so mkdirSync throws ENOTDIR
  // when it tries to create zenno/ underneath it.
  const fileAsRepoRoot = path.join(dirs.targetRepoRoot, 'not-a-directory');
  fs.writeFileSync(fileAsRepoRoot, 'i am a file');

  assert.throws(() => {
    runBootstrap({ ...dirs, targetRepoRoot: fileAsRepoRoot });
  });

  // Marker path would have been fileAsRepoRoot/zenno/.initialized — since
  // zenno/ itself could never be created, the marker cannot exist either.
  assert.equal(
    fs.existsSync(path.join(fileAsRepoRoot, 'zenno', '.initialized')),
    false
  );
});
