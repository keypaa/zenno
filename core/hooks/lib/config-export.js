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

// The transcript-recovered version had no entrypoint and no `main()` at
// all, so the documented `node config-export.js <path>` invocation was a
// silent no-op — found during the 2026-09 rebuild self-review.
function main() {
  const destArg = process.argv[2];
  if (!destArg) {
    process.stderr.write('Usage: config-export.js <destination-path>\n');
    process.exit(1);
  }
  const repoRoot = process.cwd();
  const result = exportConfig(repoRoot, path.resolve(repoRoot, destArg));
  if (!result.exported) {
    process.stderr.write(`Zenno: config export failed — ${result.reason}\n`);
    process.exit(1);
  }
  process.stdout.write(`Zenno: config exported to ${result.path}\n`);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { exportConfig };
