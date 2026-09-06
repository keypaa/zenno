const path = require('node:path');

// Session transcript files live directly in Claude Code's own
// per-project directory, as siblings of the memory/ subfolder Plan #8's
// Memory Layer uses — this reuses Foundation's deriveProjectMemoryDir
// rather than re-deriving the project slug independently, so it inherits
// that same disclosed, not-yet-empirically-verified assumption (if
// wrong, only deriveProjectMemoryDir itself needs correcting).
function deriveProjectSessionsDir(repoPath, homeDir) {
  const { deriveProjectMemoryDir } = require('../bootstrap-cli');
  const memoryDir = deriveProjectMemoryDir(repoPath, homeDir);
  return path.dirname(memoryDir);
}

function tracesOutputDir(repoRoot) {
  return path.join(repoRoot, 'zenno', 'traces');
}

function rawTracesDir(repoRoot) {
  return path.join(tracesOutputDir(repoRoot), 'raw');
}

module.exports = { deriveProjectSessionsDir, tracesOutputDir, rawTracesDir };
