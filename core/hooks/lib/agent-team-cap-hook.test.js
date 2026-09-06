const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { evaluateSpawnRequest } = require('./agent-team-cap-hook');
const { defaultState, writeAgentTeamState, readAgentTeamState } = require('./agent-team-state');

const CAPS = { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 };

test('allows a top-level spawn (no caller agent_id) at depth 1', () => {
  const result = evaluateSpawnRequest(defaultState(), null, CAPS);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.nextState.pendingDepthStack, [1]);
});

test('allows a spawn from a registered depth-1 caller, computing depth 2', () => {
  const state = { ...defaultState(), depthByAgentId: { 'agent-a': 1 } };
  const result = evaluateSpawnRequest(state, 'agent-a', CAPS);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.nextState.pendingDepthStack, [2]);
});

test('blocks a spawn that would exceed the depth cap', () => {
  const state = { ...defaultState(), depthByAgentId: { 'agent-deep': 3 } };
  const result = evaluateSpawnRequest(state, 'agent-deep', CAPS);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /depth-cap-exceeded/);
});

test('blocks a spawn that would exceed the concurrent cap', () => {
  const state = { ...defaultState(), currentActive: 8 };
  const result = evaluateSpawnRequest(state, null, CAPS);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /concurrent-cap-exceeded/);
});

test('blocks a spawn that would exceed the total-per-task cap', () => {
  const state = { ...defaultState(), totalSpawned: 10 };
  const result = evaluateSpawnRequest(state, null, CAPS);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /total-per-task-cap-exceeded/);
});

test('an unregistered caller agent_id defaults to depth 1 (not 0)', () => {
  const result = evaluateSpawnRequest(defaultState(), 'never-seen-before', CAPS);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.nextState.pendingDepthStack, [2]);
});

test('does not mutate state on a blocked request', () => {
  const state = { ...defaultState(), totalSpawned: 10 };
  const result = evaluateSpawnRequest(state, null, CAPS);
  assert.equal(result.nextState, state);
});

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-capshook-test-'));
}

function runHook(repo, payload) {
  const hookPath = path.join(__dirname, 'agent-team-cap-hook.js');
  return spawnSync('node', [hookPath], { input: JSON.stringify(payload), encoding: 'utf8', cwd: repo });
}

test('end-to-end: allows a spawn and persists the incremented state', () => {
  const repo = makeTempRepo();
  const result = runHook(repo, { cwd: repo, agent_id: null });

  assert.equal(result.status, 0);
  const state = readAgentTeamState(repo);
  assert.equal(state.totalSpawned, 1);
  assert.equal(state.currentActive, 1);
});

test('end-to-end: blocks once the total-per-task cap is already reached', () => {
  const repo = makeTempRepo();
  writeAgentTeamState(repo, { ...defaultState(), totalSpawned: 10 });

  const result = runHook(repo, { cwd: repo, agent_id: null });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Agent Team cap: blocked/);
});
