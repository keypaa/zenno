const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runGraphGeneration } = require('./generate-graph-cli');

function makeTempGitRepoWithCode() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-graphcli-test-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  fs.mkdirSync(path.join(repo, 'src'));
  fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'function fnA() {}\n');
  fs.writeFileSync(path.join(repo, 'src', 'b.js'), 'function fnB() {}\n');
  fs.writeFileSync(path.join(repo, 'src', 'c.js'), 'function fnC() {}\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: repo, stdio: 'ignore' });
  return repo;
}

test('runGraphGeneration produces both the tags file and metadata together', () => {
  const repo = makeTempGitRepoWithCode();

  const result = runGraphGeneration(repo);

  assert.equal(result.generated, true);
  assert.ok(result.tagCount > 0);
  assert.ok(fs.existsSync(result.path));
  assert.match(result.meta.generatedAtCommit, /^[0-9a-f]{40}$/);
});

test('end-to-end: running the CLI as a real subprocess generates the graph', () => {
  const repo = makeTempGitRepoWithCode();
  const cliPath = path.join(__dirname, 'generate-graph-cli.js');

  const output = execFileSync('node', [cliPath, repo], { encoding: 'utf8' });

  assert.match(output, /graph generated/);
  assert.ok(fs.existsSync(path.join(repo, 'zenno', 'graph', 'tags')));
  assert.ok(fs.existsSync(path.join(repo, 'zenno', 'graph', '.meta.json')));
});
