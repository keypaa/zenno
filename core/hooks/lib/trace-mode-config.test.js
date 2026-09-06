const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readTraceMode, DEFAULT_MODE } = require('./trace-mode-config');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-tracemode-test-'));
}

test('defaults to raw mode when config.json does not exist', () => {
  const repo = makeTempRepo();
  assert.equal(readTraceMode(repo), 'raw');
  assert.equal(DEFAULT_MODE, 'raw');
});

test('falls back to raw mode on malformed config.json', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), '{ bad json');
  assert.equal(readTraceMode(repo), 'raw');
});

test('reads a configured mode', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), JSON.stringify({ traces: { defaultMode: 'curated' } }));
  assert.equal(readTraceMode(repo), 'curated');
});
