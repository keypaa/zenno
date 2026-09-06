const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { telemetryFilePath } = require('./otlp-file-exporter');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-telemetryhook-test-'));
}

function makeTempRepoWithTelemetry(enabled, recordContent = false) {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ telemetry: { enabled, recordContent } })
  );
  return repo;
}

function runHook(repo, payload) {
  const hookPath = path.join(__dirname, 'telemetry-hook.js');
  return spawnSync('node', [hookPath], { input: JSON.stringify(payload), encoding: 'utf8', cwd: repo });
}

test('writes no telemetry file at all when disabled (the default)', () => {
  const repo = makeTempRepo();
  const result = runHook(repo, { cwd: repo, tool_name: 'Bash', tool_input: { command: 'ls' } });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(telemetryFilePath(repo)), false);
});

test('writes an execute_tool span when explicitly enabled', () => {
  const repo = makeTempRepoWithTelemetry(true);
  const result = runHook(repo, { cwd: repo, tool_name: 'Bash', tool_input: { command: 'ls' } });

  assert.equal(result.status, 0);
  assert.ok(fs.existsSync(telemetryFilePath(repo)));
  const span = JSON.parse(fs.readFileSync(telemetryFilePath(repo), 'utf8').trim());
  assert.equal(span.attributes['gen_ai.tool.name'], 'Bash');
});

test('does not record tool input content when recordContent is false (default even when enabled)', () => {
  const repo = makeTempRepoWithTelemetry(true, false);
  runHook(repo, { cwd: repo, tool_name: 'Bash', tool_input: { command: 'echo secret-looking-value' } });

  const span = JSON.parse(fs.readFileSync(telemetryFilePath(repo), 'utf8').trim());
  assert.equal(span.events.length, 0);
});

test('records tool input content only when recordContent is explicitly true', () => {
  const repo = makeTempRepoWithTelemetry(true, true);
  runHook(repo, { cwd: repo, tool_name: 'Bash', tool_input: { command: 'echo hello' } });

  const span = JSON.parse(fs.readFileSync(telemetryFilePath(repo), 'utf8').trim());
  assert.equal(span.events.length, 1);
  assert.match(span.events[0].attributes.content, /echo hello/);
});
