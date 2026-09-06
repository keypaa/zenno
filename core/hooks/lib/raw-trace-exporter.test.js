const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { exportRawTraces } = require('./raw-trace-exporter');
const { rawTracesDir } = require('./trace-paths');

function makeTempSessionsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-rawexport-sessions-'));
}

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-rawexport-repo-'));
}

test('returns exported: 0 when no session files exist', () => {
  const sessionsDir = makeTempSessionsDir();
  const repo = makeTempRepo();
  const result = exportRawTraces(repo, sessionsDir);
  assert.equal(result.exported, 0);
});

test('exports session files to zenno/traces/raw/, preserving filenames', () => {
  const sessionsDir = makeTempSessionsDir();
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(sessionsDir, 'session-1.jsonl'), '{"message":"hello"}\n');

  const result = exportRawTraces(repo, sessionsDir);

  assert.equal(result.exported, 1);
  const outputPath = path.join(rawTracesDir(repo), 'session-1.jsonl');
  assert.ok(fs.existsSync(outputPath));
  assert.match(fs.readFileSync(outputPath, 'utf8'), /hello/);
});

test('redacts secrets found in session content before writing to disk', () => {
  const sessionsDir = makeTempSessionsDir();
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(sessionsDir, 'session-1.jsonl'), '{"command":"AKIAIOSFODNN7EXAMPLE"}\n');

  const result = exportRawTraces(repo, sessionsDir);

  assert.equal(result.totalRedactions, 1);
  const outputPath = path.join(rawTracesDir(repo), 'session-1.jsonl');
  assert.doesNotMatch(fs.readFileSync(outputPath, 'utf8'), /AKIAIOSFODNN7EXAMPLE/);
});

test('exports multiple session files in one call', () => {
  const sessionsDir = makeTempSessionsDir();
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(sessionsDir, 'a.jsonl'), '{}');
  fs.writeFileSync(path.join(sessionsDir, 'b.jsonl'), '{}');

  const result = exportRawTraces(repo, sessionsDir);
  assert.equal(result.exported, 2);
});
