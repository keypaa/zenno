#!/usr/bin/env node
const fs = require('node:fs');
const { readAgentTeamState, writeAgentTeamState } = require('./agent-team-state');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function registerAgentStop(state, stoppedAgentId) {
  const { [stoppedAgentId]: _removed, ...remainingDepths } = state.depthByAgentId;
  return {
    ...state,
    currentActive: Math.max(0, state.currentActive - 1),
    depthByAgentId: stoppedAgentId ? remainingDepths : state.depthByAgentId,
  };
}

function main() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const state = readAgentTeamState(cwd);
  const nextState = registerAgentStop(state, payload.agent_id || null);
  writeAgentTeamState(cwd, nextState);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { registerAgentStop };
