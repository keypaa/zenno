const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  evaluatePackage,
  formatBlockMessage,
  readBlockGlobalInstalls,
} = require('./provenance-guard-hook');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-provenance-test-'));
}

test('evaluatePackage marks an already-declared package as not new', async () => {
  const repo = makeTempRepo();
  fs.writeFileSync(
    path.join(repo, 'package.json'),
    JSON.stringify({ dependencies: { express: '^4.0.0' } })
  );

  const result = await evaluatePackage('express', 'npm', repo);

  assert.equal(result.isNew, false);
  assert.equal(result.typosquat, null);
});

test('evaluatePackage flags a typosquat for a new package', async () => {
  const repo = makeTempRepo();

  const result = await evaluatePackage('expres', 'npm', repo);

  assert.equal(result.isNew, true);
  assert.equal(result.typosquat.isTyposquat, true);
});

test('formatBlockMessage names both the suspicious and suspected-real package', () => {
  const message = formatBlockMessage({
    packageName: 'expres',
    typosquat: { isTyposquat: true, suspectedRealPackage: 'express', distance: 1 },
  });

  assert.match(message, /expres/);
  assert.match(message, /express/);
});

test('readBlockGlobalInstalls defaults to true when config.json does not exist', () => {
  const repo = makeTempRepo();
  assert.equal(readBlockGlobalInstalls(repo), true);
});

test('readBlockGlobalInstalls defaults to true on malformed config — fails safe', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), '{ bad json');

  assert.equal(readBlockGlobalInstalls(repo), true);
});

test('readBlockGlobalInstalls respects an explicit false override', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ shield: { provenanceGuard: { blockGlobalInstalls: false } } })
  );

  assert.equal(readBlockGlobalInstalls(repo), false);
});

// --- Real subprocess tests: actual exit-code contract, including a real
// network call to the npm registry for the "not a typosquat, just new"
// path.

function runHook(payload) {
  const hookPath = path.join(__dirname, 'provenance-guard-hook.js');
  return spawnSync('node', [hookPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 15000,
  });
}

test('exits 0 immediately for a non-install Bash command', () => {
  const repo = makeTempRepo();
  const result = runHook({ tool_name: 'Bash', tool_input: { command: 'ls -la' }, cwd: repo });
  assert.equal(result.status, 0);
});

test('exits 2 blocking a global npm install by default', () => {
  const repo = makeTempRepo();
  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'npm install -g some-random-cli-tool' },
    cwd: repo,
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /global\/system-wide installs are disabled/);
});

test('exits 2 blocking an obvious typosquat of a well-known package', () => {
  const repo = makeTempRepo();
  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'npm install expres' },
    cwd: repo,
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /typosquat/);
});

test('exits 0 for a package already declared in the manifest (routine reinstall)', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(
    path.join(repo, 'package.json'),
    JSON.stringify({ dependencies: { lodash: '^4.0.0' } })
  );

  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'npm install lodash' },
    cwd: repo,
  });

  assert.equal(result.status, 0);
  // Not new, so no journal entry should have been written at all.
  assert.equal(fs.existsSync(path.join(repo, 'zenno', 'audit', 'journal.jsonl')), false);
});

test('logs a new, legitimate package to the journal without blocking', () => {
  const repo = makeTempRepo();

  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'npm install is-odd' },
    cwd: repo,
  });

  assert.equal(result.status, 0);
  const journalPath = path.join(repo, 'zenno', 'audit', 'journal.jsonl');
  assert.ok(fs.existsSync(journalPath));
  const entry = JSON.parse(fs.readFileSync(journalPath, 'utf8').trim());
  assert.equal(entry.type, 'new-dependency');
  assert.equal(entry.package, 'is-odd');
});
