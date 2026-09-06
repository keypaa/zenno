#!/usr/bin/env node
const fs = require('node:fs');
const { readAgentTeamState, writeAgentTeamState } = require('./agent-team-state');
const { readAgentTeamCaps } = require('./read-agent-team-caps');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function evaluateSpawnRequest(state, callerAgentId, caps) {
  const callerDepth = callerAgentId ? (state.depthByAgentId[callerAgentId] ?? 1) : 0;
  const newDepth = callerDepth + 1;
  const newConcurrent = state.currentActive + 1;
  const newTotal = state.totalSpawned + 1;

  if (newDepth > caps.depthCap) {
    return { allowed: false, reason: `depth-cap-exceeded (would be depth ${newDepth}, cap is ${caps.depthCap})`, nextState: state };
  }
  if (newConcurrent > caps.concurrentCap) {
    return { allowed: false, reason: `concurrent-cap-exceeded (would be ${newConcurrent} active, cap is ${caps.concurrentCap})`, nextState: state };
  }
  if (newTotal > caps.totalPerTaskCap) {
    return { allowed: false, reason: `total-per-task-cap-exceeded (would be ${newTotal} spawned, cap is ${caps.totalPerTaskCap})`, nextState: state };
  }

  const nextState = {
    ...state,
    totalSpawned: newTotal,
    currentActive: newConcurrent,
    pendingDepthStack: [...state.pendingDepthStack, newDepth],
  };

  return { allowed: true, reason: null, nextState };
}

function main() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const callerAgentId = payload.agent_id || null;

  const state = readAgentTeamState(cwd);
  const caps = readAgentTeamCaps(cwd);
  const result = evaluateSpawnRequest(state, callerAgentId, caps);

  if (!result.allowed) {
    process.stderr.write(
      `Zenno Agent Team cap: blocked — ${result.reason}. Configure ` +
        'agentTeam caps in zenno/config.json if this limit is genuinely ' +
        'too tight for a legitimate workflow.\n'
    );
    process.exit(2);
  }

  writeAgentTeamState(cwd, result.nextState);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { evaluateSpawnRequest };
