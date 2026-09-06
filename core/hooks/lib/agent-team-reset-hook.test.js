const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readAgentTeamState, writeAgentTeamState } = require('./agent-team-state');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-reset-test-'));
}

test('end-to-end: resets a non-default state back to defaults', () => {
  const repo = makeTempRepo();
  writeAgentTeamState(repo, {
    totalSpawned: 9,
    currentActive: 3,
    depthByAgentId: { x: 2 },
    pendingDepthStack: [2],
  });

  const hookPath = path.join(__dirname, 'agent-team-reset-hook.js');
  execFileSync('node', [hookPath], { input: JSON.stringify({ cwd: repo }) });

  const state = readAgentTeamState(repo);
  assert.equal(state.totalSpawned, 0);
  assert.equal(state.currentActive, 0);
  assert.deepEqual(state.depthByAgentId, {});
});

test('never blocks — exits 0 even on a fresh repo with no prior state', () => {
  const repo = makeTempRepo();
  const hookPath = path.join(__dirname, 'agent-team-reset-hook.js');

  execFileSync('node', [hookPath], { input: JSON.stringify({ cwd: repo }) });
});
