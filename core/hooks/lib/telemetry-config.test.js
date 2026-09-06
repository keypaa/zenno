const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readTelemetryConfig } = require('./telemetry-config');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-telemetryconfig-test-'));
}

test('defaults to disabled, no content recording, when config.json does not exist', () => {
  const repo = makeTempRepo();
  assert.deepEqual(readTelemetryConfig(repo), { enabled: false, recordContent: false });
});

test('fails safe to disabled on malformed config.json', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), '{ bad json');
  assert.deepEqual(readTelemetryConfig(repo), { enabled: false, recordContent: false });
});

test('reads an explicit opt-in from config.json', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ telemetry: { enabled: true, recordContent: false } })
  );
  assert.deepEqual(readTelemetryConfig(repo), { enabled: true, recordContent: false });
});

test('content recording can be enabled independently of tracing', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ telemetry: { enabled: true, recordContent: true } })
  );
  assert.deepEqual(readTelemetryConfig(repo), { enabled: true, recordContent: true });
});
