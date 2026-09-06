const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveMode, runExport } = require('./export-traces-cli');
const { rawTracesDir } = require('./trace-paths');

test('resolveMode prefers an explicit mode over config', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-resolvemode-test-'));
  assert.equal(resolveMode('raw', repo), 'raw');
});

test('resolveMode falls back to config (and its own default) when no explicit mode given', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-resolvemode-test-'));
  assert.equal(resolveMode(null, repo), 'raw');
});

test('runExport refuses curated mode explicitly, does not silently do something else', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-runexport-test-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-runexport-home-'));
  const result = runExport(repo, homeDir, 'curated');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'curated-mode-not-implemented');
});

test('runExport rejects an unrecognized mode', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-runexport-test-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-runexport-home-'));
  const result = runExport(repo, homeDir, 'bogus-mode');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'unknown-mode');
});

test('end-to-end: CLI reports zero exported and exits 0 when no sessions exist', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-cli-e2e-test-'));
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-cli-e2e-home-'));
  const cliPath = path.join(__dirname, 'export-traces-cli.js');

  const result = spawnSync('node', [cliPath, '--mode=raw'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /no session transcripts found/);
});

test('end-to-end: CLI exits 1 with a clear message for curated mode', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-cli-e2e-test-'));
  const cliPath = path.join(__dirname, 'export-traces-cli.js');

  const result = spawnSync('node', [cliPath, '--mode=curated'], { cwd: repo, encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /not yet implemented/);
});
