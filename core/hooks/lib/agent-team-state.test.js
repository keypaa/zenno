const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readAgentTeamState, writeAgentTeamState, defaultState } = require('./agent-team-state');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-agentstate-test-'));
}

test('readAgentTeamState returns defaults when no state file exists yet', () => {
  const repo = makeTempRepo();
  const state = readAgentTeamState(repo);
  assert.deepEqual(state, defaultState());
});

test('writeAgentTeamState creates zenno/ if it does not exist yet', () => {
  const repo = makeTempRepo();
  writeAgentTeamState(repo, { ...defaultState(), totalSpawned: 3 });

  assert.ok(fs.existsSync(path.join(repo, 'zenno', '.agent-team-state.json')));
});

test('round-trips a written state exactly', () => {
  const repo = makeTempRepo();
  const state = {
    totalSpawned: 5,
    currentActive: 2,
    depthByAgentId: { 'agent-abc': 1 },
    pendingDepthStack: [2, 2],
  };
  writeAgentTeamState(repo, state);

  assert.deepEqual(readAgentTeamState(repo), state);
});

test('falls back to defaults on a malformed state file — does not crash', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', '.agent-team-state.json'), '{ not valid json');

  assert.deepEqual(readAgentTeamState(repo), defaultState());
});
