const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { registerAgentStart } = require('./agent-team-start-hook');
const { defaultState, writeAgentTeamState, readAgentTeamState } = require('./agent-team-state');

test('pops the pending depth and registers it under the new agent id', () => {
  const state = { ...defaultState(), pendingDepthStack: [1] };
  const result = registerAgentStart(state, 'agent-new');

  assert.deepEqual(result.depthByAgentId, { 'agent-new': 1 });
  assert.deepEqual(result.pendingDepthStack, []);
});

test('pops LIFO (most recent pending depth) when multiple are queued', () => {
  const state = { ...defaultState(), pendingDepthStack: [1, 2, 2] };
  const result = registerAgentStart(state, 'agent-c');

  assert.equal(result.depthByAgentId['agent-c'], 2);
  assert.deepEqual(result.pendingDepthStack, [1, 2]);
});

test('defaults to depth 1 if the pending stack is unexpectedly empty', () => {
  const state = { ...defaultState(), pendingDepthStack: [] };
  const result = registerAgentStart(state, 'agent-orphan');

  assert.equal(result.depthByAgentId['agent-orphan'], 1);
});

test('is a no-op if no agent id is provided', () => {
  const state = { ...defaultState(), pendingDepthStack: [1] };
  const result = registerAgentStart(state, null);

  assert.deepEqual(result, state);
});

test('end-to-end: registers depth via a real subprocess call', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-starthook-test-'));
  writeAgentTeamState(repo, { ...defaultState(), pendingDepthStack: [2] });

  const hookPath = path.join(__dirname, 'agent-team-start-hook.js');
  execFileSync('node', [hookPath], { input: JSON.stringify({ cwd: repo, agent_id: 'real-agent-1' }) });

  const state = readAgentTeamState(repo);
  assert.equal(state.depthByAgentId['real-agent-1'], 2);
});
