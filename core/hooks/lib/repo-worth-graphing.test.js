const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isRepoWorthGraphing } = require('./repo-worth-graphing');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-worthgraph-test-'));
}

test('a brand-new empty repo is not worth graphing', () => {
  const repo = makeTempRepo();
  assert.equal(isRepoWorthGraphing(repo), false);
});

test('a repo with only a .git and node_modules is not worth graphing', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, '.git'));
  fs.writeFileSync(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  fs.mkdirSync(path.join(repo, 'node_modules', 'some-pkg'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'node_modules', 'some-pkg', 'index.js'), '');

  assert.equal(isRepoWorthGraphing(repo), false);
});

test('a repo with a handful of real source files is worth graphing', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(repo, 'index.js'), 'module.exports = {};');
  fs.mkdirSync(path.join(repo, 'src'));
  fs.writeFileSync(path.join(repo, 'src', 'main.js'), 'console.log(1);');
  fs.writeFileSync(path.join(repo, 'src', 'utils.js'), 'exports.x = 1;');

  assert.equal(isRepoWorthGraphing(repo), true);
});

test('a single lonely README is not worth graphing', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(repo, 'README.md'), '# hello');

  assert.equal(isRepoWorthGraphing(repo), false);
});
