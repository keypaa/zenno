const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { classifyGitCommand, formatFindingsMessage } = require('./secret-scanner-hook');

test('classifyGitCommand identifies a plain git commit', () => {
  assert.equal(classifyGitCommand('git commit -m "fix bug"'), 'commit');
});

test('classifyGitCommand identifies a git push', () => {
  assert.equal(classifyGitCommand('git push origin main'), 'push');
});

test('classifyGitCommand identifies a commit chained after other commands', () => {
  assert.equal(classifyGitCommand('git add . && git commit -m "wip"'), 'commit');
});

test('classifyGitCommand returns null for unrelated commands', () => {
  assert.equal(classifyGitCommand('git status'), null);
  assert.equal(classifyGitCommand('npm test'), null);
  assert.equal(classifyGitCommand('git log --oneline'), null);
});

test('classifyGitCommand does not misclassify git commit-tree as commit', () => {
  // \bgit\s+commit\b alone matches here too, since \b matches at the
  // letter-to-hyphen boundary in "commit-tree" — a different, unrelated
  // git plumbing command that must never trigger the scanner.
  assert.equal(classifyGitCommand('git commit-tree -p HEAD'), null);
});

test('formatFindingsMessage only lists high-confidence findings, not medium', () => {
  const findings = [
    { type: 'aws-access-key-id', matchedText: 'AKIAIOSFODNN7EXAMPLE', line: 3, confidence: 'high' },
    { type: 'high-entropy-string', matchedText: 'xK9mQ2vL8pR4wZ1nT6bY3jC7hF5dS0aE', line: 5, confidence: 'medium' },
  ];
  const message = formatFindingsMessage(findings);

  assert.match(message, /aws-access-key-id/);
  assert.doesNotMatch(message, /high-entropy-string/);
});

// --- Real subprocess tests: these verify the actual Claude Code hook
// contract (exit code 2 = block, exit code 0 = allow) against real git
// repos, not just the pure-function logic above.

function makeTempGitRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-hook-e2e-test-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  return repo;
}

function runHook(payload) {
  const hookPath = path.join(__dirname, 'secret-scanner-hook.js');
  return spawnSync('node', [hookPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

test('exits 2 and blocks when staged content contains a high-confidence secret', () => {
  const repo = makeTempGitRepo();
  fs.writeFileSync(path.join(repo, 'secret.txt'), 'AKIAIOSFODNN7EXAMPLE');
  execFileSync('git', ['add', 'secret.txt'], { cwd: repo });

  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'git commit -m "adding config"' },
    cwd: repo,
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Secret Scanner: blocked/);
  assert.match(result.stderr, /aws-access-key-id/);
});

test('exits 0 and allows a clean commit with no secrets', () => {
  const repo = makeTempGitRepo();
  fs.writeFileSync(path.join(repo, 'readme.txt'), 'just a normal readme file');
  execFileSync('git', ['add', 'readme.txt'], { cwd: repo });

  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'git commit -m "add readme"' },
    cwd: repo,
  });

  assert.equal(result.status, 0);
});

test('exits 0 immediately for a non-git-commit Bash command, without scanning anything', () => {
  const repo = makeTempGitRepo();

  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'ls -la' },
    cwd: repo,
  });

  assert.equal(result.status, 0);
});

test('an allowlisted secret in the staged diff does not block the commit', () => {
  const repo = makeTempGitRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ shield: { secretScanner: { allowlist: ['AKIAIOSFODNN7EXAMPLE'] } } })
  );
  fs.writeFileSync(path.join(repo, 'fixture.txt'), 'AKIAIOSFODNN7EXAMPLE');
  execFileSync('git', ['add', 'fixture.txt'], { cwd: repo });

  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'git commit -m "add test fixture"' },
    cwd: repo,
  });

  assert.equal(result.status, 0);
});
