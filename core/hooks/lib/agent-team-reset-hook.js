#!/usr/bin/env node
const fs = require('node:fs');
const { writeAgentTeamState, defaultState } = require('./agent-team-state');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function main() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  writeAgentTeamState(cwd, defaultState());
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {};
