const fs = require('node:fs');
const path = require('node:path');

function exportConfig(repoRoot, destPath) {
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  if (!fs.existsSync(configPath)) {
    return { exported: false, reason: 'no-config-to-export' };
  }
  const content = fs.readFileSync(configPath, 'utf8');
  fs.writeFileSync(destPath, content, 'utf8');
  return { exported: true, path: destPath };
}

module.exports = { exportConfig };
