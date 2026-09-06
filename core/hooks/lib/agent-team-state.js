const fs = require('node:fs');
const path = require('node:path');

function statePath(repoRoot) {
  return path.join(repoRoot, 'zenno', '.agent-team-state.json');
}

function defaultState() {
  return {
    totalSpawned: 0,
    currentActive: 0,
    depthByAgentId: {},
    pendingDepthStack: [],
  };
}

function readAgentTeamState(repoRoot) {
  const p = statePath(repoRoot);
  if (!fs.existsSync(p)) {
    return defaultState();
  }
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch {
    return defaultState();
  }
}

function writeAgentTeamState(repoRoot, state) {
  const p = statePath(repoRoot);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

module.exports = { readAgentTeamState, writeAgentTeamState, defaultState, statePath };
