const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CAPS = {
  depthCap: 3,
  concurrentCap: 8,
  totalPerTaskCap: 10,
};

function readAgentTeamCaps(repoRoot) {
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CAPS };
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const caps = config?.agentTeam;
    return {
      depthCap: caps?.depthCap ?? DEFAULT_CAPS.depthCap,
      concurrentCap: caps?.concurrentCap ?? DEFAULT_CAPS.concurrentCap,
      totalPerTaskCap: caps?.totalPerTaskCap ?? DEFAULT_CAPS.totalPerTaskCap,
    };
  } catch {
    return { ...DEFAULT_CAPS };
  }
}

module.exports = { readAgentTeamCaps, DEFAULT_CAPS };
