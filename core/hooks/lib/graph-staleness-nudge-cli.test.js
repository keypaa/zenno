const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkAndNudge } = require('./graph-staleness-nudge-cli');

function makeTempGitRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-nudge-test-'));
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

test('does not nudge for a repo too small to be worth graphing', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'README.md', '# hi', 'first');

  const result = checkAndNudge(repo);

  assert.equal(result.nudged, false);
  assert.equal(result.reason, 'repo-too-small');
});

test('nudges when a graph-worthy repo has never been graphed', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'a.js', 'function a() {}', 'first');
  commit(repo, 'b.js', 'function b() {}', 'second');
  commit(repo, 'c.js', 'function c() {}', 'third');

  const result = checkAndNudge(repo);

  assert.equal(result.nudged, true);
  assert.equal(result.staleness.reason, 'never-generated');
});

test('end-to-end: the CLI never exits non-zero, even when nudging (never blocks)', () => {
  const repo = makeTempGitRepo();
  commit(repo, 'a.js', 'function a() {}', 'first');
  commit(repo, 'b.js', 'function b() {}', 'second');
  commit(repo, 'c.js', 'function c() {}', 'third');
  const cliPath = path.join(__dirname, 'graph-staleness-nudge-cli.js');

  // execFileSync throws on non-zero exit — the mere fact this doesn't
  // throw proves the hook never blocks SessionStart.
  const output = execFileSync('node', [cliPath], {
    input: JSON.stringify({ cwd: repo }),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  assert.equal(output, ''); // nudge goes to stderr, not stdout
});
