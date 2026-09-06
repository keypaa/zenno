const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { writeGraphMetadata, readGraphMetadata, getCurrentCommit } = require('./graph-metadata');

function makeTempGitRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-graphmeta-test-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'file.txt'), 'hello');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: repo, stdio: 'ignore' });
  return repo;
}

test('getCurrentCommit returns a real 40-char commit hash for a git repo', () => {
  const repo = makeTempGitRepo();
  const commit = getCurrentCommit(repo);
  assert.match(commit, /^[0-9a-f]{40}$/);
});

test('getCurrentCommit returns null for a non-git directory', () => {
  const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-notgit-test-'));
  assert.equal(getCurrentCommit(nonGitDir), null);
});

test('writeGraphMetadata records the current commit and a timestamp', () => {
  const repo = makeTempGitRepo();
  const outputDir = path.join(repo, 'zenno', 'graph');
  fs.mkdirSync(outputDir, { recursive: true });

  const meta = writeGraphMetadata(repo, outputDir);

  assert.match(meta.generatedAtCommit, /^[0-9a-f]{40}$/);
  assert.ok(new Date(meta.generatedAt).toString() !== 'Invalid Date');
});

test('readGraphMetadata reads back exactly what was written', () => {
  const repo = makeTempGitRepo();
  const outputDir = path.join(repo, 'zenno', 'graph');
  fs.mkdirSync(outputDir, { recursive: true });
  const written = writeGraphMetadata(repo, outputDir);

  const read = readGraphMetadata(outputDir);

  assert.deepEqual(read, written);
});

test('readGraphMetadata returns null when no graph has ever been generated', () => {
  const repo = makeTempGitRepo();
  const outputDir = path.join(repo, 'zenno', 'graph');

  assert.equal(readGraphMetadata(outputDir), null);
});

test('writeGraphMetadata creates outputDir itself if not already present', () => {
  const repo = makeTempGitRepo();
  const outputDir = path.join(repo, 'zenno', 'graph');
  // Deliberately NOT pre-creating outputDir here, unlike the tests above —
  // this exercises the case where writeGraphMetadata is the first thing to
  // touch this directory.
  const meta = writeGraphMetadata(repo, outputDir);

  assert.ok(fs.existsSync(path.join(outputDir, '.meta.json')));
  assert.match(meta.generatedAtCommit, /^[0-9a-f]{40}$/);
});
