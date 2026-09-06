const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { getStagedDiff, getUnpushedDiff } = require('./get-git-diffs');

function makeTempGitRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-diffs-test-'));
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

test('getStagedDiff returns empty string when nothing is staged', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'a.txt', 'a', 'first');

  assert.equal(getStagedDiff(repo), '');
});

test('getStagedDiff captures real content of a staged file', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'a.txt', 'a', 'first');
  fs.writeFileSync(path.join(repo, 'secret.txt'), 'AKIAIOSFODNN7EXAMPLE');
  execFileSync('git', ['add', 'secret.txt'], { cwd: repo });

  const diff = getStagedDiff(repo);

  assert.match(diff, /AKIAIOSFODNN7EXAMPLE/);
});

test('getUnpushedDiff falls back to the last commit when no upstream is configured', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'a.txt', 'AKIAIOSFODNN7EXAMPLE', 'first commit with a secret');

  // No remote/upstream configured at all in this temp repo — this exercises
  // the fallback path, not the @{u} happy path.
  const diff = getUnpushedDiff(repo);

  assert.match(diff, /AKIAIOSFODNN7EXAMPLE/);
});

test('getUnpushedDiff returns empty string for a repo with no commits at all', () => {
  const repo = makeTempGitRepo();

  assert.equal(getUnpushedDiff(repo), '');
});
