const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { registerAgentStop } = require('./agent-team-stop-hook');
const { defaultState, writeAgentTeamState, readAgentTeamState } = require('./agent-team-state');

test('decrements currentActive by one', () => {
  const state = { ...defaultState(), currentActive: 3 };
  const result = registerAgentStop(state, 'agent-x');
  assert.equal(result.currentActive, 2);
});

test('never decrements below zero', () => {
  const state = { ...defaultState(), currentActive: 0 };
  const result = registerAgentStop(state, 'agent-x');
  assert.equal(result.currentActive, 0);
});

test('removes the stopped agent from depthByAgentId', () => {
  const state = { ...defaultState(), currentActive: 1, depthByAgentId: { 'agent-x': 2, 'agent-y': 1 } };
  const result = registerAgentStop(state, 'agent-x');

  assert.deepEqual(result.depthByAgentId, { 'agent-y': 1 });
});

test('is safe when no agent id is provided', () => {
  const state = { ...defaultState(), currentActive: 1, depthByAgentId: { 'agent-y': 1 } };
  const result = registerAgentStop(state, null);

  assert.equal(result.currentActive, 0);
  assert.deepEqual(result.depthByAgentId, { 'agent-y': 1 });
});

test('end-to-end: decrements and cleans up via a real subprocess call', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-stophook-test-'));
  writeAgentTeamState(repo, {
    ...defaultState(),
    currentActive: 2,
    depthByAgentId: { 'real-agent-1': 1 },
  });

  const hookPath = path.join(__dirname, 'agent-team-stop-hook.js');
  execFileSync('node', [hookPath], { input: JSON.stringify({ cwd: repo, agent_id: 'real-agent-1' }) });

  const state = readAgentTeamState(repo);
  assert.equal(state.currentActive, 1);
  assert.deepEqual(state.depthByAgentId, {});
});
