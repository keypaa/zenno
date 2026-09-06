const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkGraphStaleness } = require('./check-graph-staleness');
const { writeGraphMetadata } = require('./graph-metadata');

function makeTempGitRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-staleness-test-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  return repo;
}

function commit(repo, filename, content, message) {
  fs.writeFileSync(path.join(repo, filename), content);
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-m', message], { cwd: repo, stdio: 'ignore' });
}

test('reports stale with reason "never-generated" when no graph exists yet', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'a.txt', 'a', 'first');
  const outputDir = path.join(repo, 'zenno', 'graph');

  const result = checkGraphStaleness(repo, outputDir);

  assert.equal(result.stale, true);
  assert.equal(result.reason, 'never-generated');
});

test('reports not stale immediately after generation', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'a.txt', 'a', 'first');
  const outputDir = path.join(repo, 'zenno', 'graph');
  fs.mkdirSync(outputDir, { recursive: true });
  writeGraphMetadata(repo, outputDir);

  const result = checkGraphStaleness(repo, outputDir);

  assert.equal(result.stale, false);
  assert.equal(result.commitsBehind, 0);
});

test('reports stale with an accurate commit count after new commits land', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'a.txt', 'a', 'first');
  const outputDir = path.join(repo, 'zenno', 'graph');
  fs.mkdirSync(outputDir, { recursive: true });
  writeGraphMetadata(repo, outputDir);

  commit(repo, 'b.txt', 'b', 'second');
  commit(repo, 'c.txt', 'c', 'third');

  const result = checkGraphStaleness(repo, outputDir);

  assert.equal(result.stale, true);
  assert.equal(result.commitsBehind, 2);
  assert.equal(result.reason, 'commits-since-last-generation');
});
