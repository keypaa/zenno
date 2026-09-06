const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MODE = 'raw';

function readTraceMode(repoRoot) {
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  if (!fs.existsSync(configPath)) return DEFAULT_MODE;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config?.traces?.defaultMode ?? DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

module.exports = { readTraceMode, DEFAULT_MODE };
