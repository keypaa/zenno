const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scaffoldFolders, SUBFOLDERS } = require('./scaffold-folders');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-scaffold-test-'));
}

test('creates zenno/ and all six subfolders on a fresh repo', () => {
  const repo = makeTempRepo();
  const result = scaffoldFolders(repo);

  assert.ok(fs.existsSync(path.join(repo, 'zenno')));
  for (const sub of SUBFOLDERS) {
    assert.ok(
      fs.existsSync(path.join(repo, 'zenno', sub)),
      `expected zenno/${sub} to exist`
    );
  }
  assert.equal(result.created.length, 8); // zenno/ + 6 subfolders + .gitignore
});

test('is idempotent — running twice creates nothing new the second time', () => {
  const repo = makeTempRepo();
  scaffoldFolders(repo);
  const secondRun = scaffoldFolders(repo);

  assert.deepEqual(secondRun.created, []);
});

test('adds the three ephemeral folders to .gitignore, does not duplicate on rerun', () => {
  const repo = makeTempRepo();
  scaffoldFolders(repo);
  const gitignore = fs.readFileSync(path.join(repo, '.gitignore'), 'utf8');

  assert.match(gitignore, /zenno\/traces\//);
  assert.match(gitignore, /zenno\/telemetry\//);
  assert.match(gitignore, /zenno\/graph\//);
  assert.doesNotMatch(gitignore, /zenno\/plans\//); // plans/specs stay committed

  scaffoldFolders(repo); // second run
  const gitignoreAfter = fs.readFileSync(path.join(repo, '.gitignore'), 'utf8');
  const occurrences = (gitignoreAfter.match(/zenno\/traces\//g) || []).length;
  assert.equal(occurrences, 1, 'entry should not be duplicated on rerun');
});

test('preserves existing .gitignore content', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  scaffoldFolders(repo);
  const gitignore = fs.readFileSync(path.join(repo, '.gitignore'), 'utf8');

  assert.match(gitignore, /node_modules\//);
  assert.match(gitignore, /zenno\/traces\//);
});
