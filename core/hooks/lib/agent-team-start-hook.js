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

function registerAgentStart(state, newAgentId) {
  if (!newAgentId) {
    return state;
  }
  const stack = [...state.pendingDepthStack];
  const depth = stack.length > 0 ? stack.pop() : 1;
  return {
    ...state,
    pendingDepthStack: stack,
    depthByAgentId: { ...state.depthByAgentId, [newAgentId]: depth },
  };
}

function main() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const state = readAgentTeamState(cwd);
  const nextState = registerAgentStart(state, payload.agent_id || null);
  writeAgentTeamState(cwd, nextState);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { registerAgentStart };
