const fs = require('node:fs');
const path = require('node:path');

const { scaffoldFolders } = require('./lib/scaffold-folders');
const { writeConfigSkeleton } = require('./lib/write-config');
const { writeAttributionDefault } = require('./lib/write-attribution');
const { writeSuperpowersRedirect } = require('./lib/redirect-superpowers');
const { checkExternalTools } = require('./lib/check-tools');
const { initMemorySnapshotRepo } = require('./lib/init-memory-repo');

function runBootstrap({ targetRepoRoot, homeDir, memoryDir }) {
  const markerPath = path.join(targetRepoRoot, 'zenno', '.initialized');

  if (fs.existsSync(markerPath)) {
    return { ranBootstrap: false, results: null };
  }

  const results = {
    scaffold: scaffoldFolders(targetRepoRoot),
    config: writeConfigSkeleton(targetRepoRoot),
    attribution: writeAttributionDefault(homeDir),
    superpowersRedirect: writeSuperpowersRedirect(targetRepoRoot),
    tools: checkExternalTools(),
    memoryRepo: initMemorySnapshotRepo(memoryDir),
  };

  // Marker is written last and only after every prior step has succeeded —
  // if any step above throws, the marker is never written, and the next
  // session start will safely retry the whole bootstrap from scratch
  // rather than getting stuck half-initialized.
  fs.writeFileSync(
    markerPath,
    JSON.stringify({ initializedAt: new Date().toISOString() }, null, 2) + '\n',
    'utf8'
  );

  return { ranBootstrap: true, results };
}

module.exports = { runBootstrap };
