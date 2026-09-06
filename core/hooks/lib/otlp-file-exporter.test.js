const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { exportSpan, telemetryFilePath } = require('./otlp-file-exporter');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-otlpexport-test-'));
}

test('exportSpan creates zenno/telemetry/ and writes a dated jsonl file', () => {
  const repo = makeTempRepo();
  exportSpan(repo, { name: 'execute_tool' });

  const filePath = telemetryFilePath(repo);
  assert.ok(fs.existsSync(filePath));
  const content = fs.readFileSync(filePath, 'utf8').trim();
  assert.deepEqual(JSON.parse(content), { name: 'execute_tool' });
});

test('exportSpan appends multiple spans without overwriting', () => {
  const repo = makeTempRepo();
  exportSpan(repo, { name: 'first' });
  exportSpan(repo, { name: 'second' });

  const lines = fs.readFileSync(telemetryFilePath(repo), 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
});
