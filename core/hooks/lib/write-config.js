const fs = require('node:fs');
const path = require('node:path');

function defaultConfig() {
  return {
    version: 1,
    shield: {
      confidentialFileGuard: {
        denyPatterns: [
          '.env',
          '.env.*',
          '*.pem',
          '*.key',
          'id_rsa',
          'id_ed25519',
          'credentials.json',
          'secrets.yml',
          'secrets.yaml',
          '.npmrc',
          '.netrc',
        ],
        allowPatterns: ['.env.example', '.env.sample', '.env.template'],
      },
      provenanceGuard: {
        typosquatList: [],
        blockGlobalInstalls: true,
      },
      secretScanner: {
        allowlist: [],
      },
    },
    agentTeam: {
      depthCap: 3,
      concurrentCap: 8,
      totalPerTaskCap: 10,
    },
    telemetry: {
      enabled: false,
      recordContent: false,
    },
    traces: {
      defaultMode: 'raw',
    },
  };
}

function writeConfigSkeleton(targetRepoRoot) {
  const configPath = path.join(targetRepoRoot, 'zenno', 'config.json');

  if (fs.existsSync(configPath)) {
    return { path: configPath, created: false };
  }

  fs.writeFileSync(
    configPath,
    JSON.stringify(defaultConfig(), null, 2) + '\n',
    'utf8'
  );
  return { path: configPath, created: true };
}

module.exports = { writeConfigSkeleton, defaultConfig };
