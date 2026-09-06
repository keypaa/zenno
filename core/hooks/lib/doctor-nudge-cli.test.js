const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runNudge } = require('./doctor-nudge-cli');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', '..');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-doctor-nudge-test-'));
}

function writeValidConfig(repo) {
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'zenno', 'traces'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({
      version: 1,
      shield: {},
      agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 },
      telemetry: { enabled: false, recordContent: false },
      traces: { defaultMode: 'raw', targetDir: 'zenno/traces' },
    })
  );
}

function writeMarker(repo) {
  fs.writeFileSync(
    path.join(repo, 'zenno', '.initialized'),
    JSON.stringify({ initializedAt: '2026-09-06T00:00:00.000Z' })
  );
}

test('silent + exit 0 when everything cheap is OK', () => {
  const repo = makeTempRepo();
  writeValidConfig(repo);
  writeMarker(repo);
  // A provisioned memory snapshots dir (working private git repo) so the
  // install-health group is fully OK — redirected via fake HOME.
  const fakeHome = makeTempRepo();
  const slug = repo.replace(/^[A-Za-z]:/, '').split(/[\\/]/).filter(Boolean).join('-');
  const snapshots = path.join(fakeHome, '.claude', 'projects', `-${slug}`, 'memory', 'zenno', 'snapshots');
  fs.mkdirSync(snapshots, { recursive: true });
  const { execFileSync } = require('node:child_process');
  execFileSync('git', ['init', '-q'], { cwd: snapshots });
  const { output, exitCode } = runNudge(PLUGIN_ROOT, repo, fakeHome);
  assert.equal(output, '');
  assert.equal(exitCode, 0);
});

test('missing config surfaces a WARN line + details pointer', () => {
  const repo = makeTempRepo();
  const { output, exitCode } = runNudge(PLUGIN_ROOT, repo, makeTempRepo());
  assert.equal(exitCode, 1);
  assert.match(output, /\[WARN\]/);
  assert.match(output, /run zenno doctor for details/);
});

test('missing hook file surfaces a FAIL naming it', () => {
  const repo = makeTempRepo();
  writeValidConfig(repo);
  writeMarker(repo);
  const fakePlugin = makeTempRepo();
  fs.mkdirSync(path.join(fakePlugin, 'core', 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(fakePlugin, 'core', 'hooks', 'hooks.json'),
    JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/core/hooks/lib/gone.js"' }] }] },
    })
  );
  const { output, exitCode } = runNudge(fakePlugin, repo, makeTempRepo());
  assert.equal(exitCode, 1);
  assert.match(output, /\[FAIL\].*gone\.js/);
  assert.match(output, /run zenno doctor for details/);
});

test('memory snapshots dir without .git surfaces the history-loss FAIL', () => {
  const repo = makeTempRepo();
  writeValidConfig(repo);
  writeMarker(repo);
  const fakeHome = makeTempRepo();
  const slug = repo.replace(/^[A-Za-z]:/, '').split(/[\\/]/).filter(Boolean).join('-');
  fs.mkdirSync(path.join(fakeHome, '.claude', 'projects', `-${slug}`, 'memory', 'zenno', 'snapshots'), { recursive: true });
  const { output, exitCode } = runNudge(PLUGIN_ROOT, repo, fakeHome);
  assert.equal(exitCode, 1);
  assert.match(output, /history lost/);
});

test('nudge output never contains a fix line — fixes live in the full doctor', () => {
  const repo = makeTempRepo(); // no config → WARN
  const { output } = runNudge(PLUGIN_ROOT, repo, makeTempRepo());
  assert.doesNotMatch(output, /fix:/);
});
