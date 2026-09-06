const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { enabled: false, recordContent: false };

function readTelemetryConfig(repoRoot) {
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  if (!fs.existsSync(configPath)) return { ...DEFAULTS };
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const t = config?.telemetry;
    return {
      enabled: t?.enabled ?? DEFAULTS.enabled,
      recordContent: t?.recordContent ?? DEFAULTS.recordContent,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

module.exports = { readTelemetryConfig, DEFAULTS };
