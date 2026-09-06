const fs = require('node:fs');
const path = require('node:path');
function zennoMemoryRoot(memoryDir) { return path.join(memoryDir, 'zenno'); }
function episodicDir(memoryDir) { return path.join(zennoMemoryRoot(memoryDir), 'episodic'); }
function semanticDir(memoryDir) { return path.join(zennoMemoryRoot(memoryDir), 'semantic'); }
function workingDir(memoryDir) { return path.join(zennoMemoryRoot(memoryDir), 'working'); }
function snapshotsDir(memoryDir) { return path.join(zennoMemoryRoot(memoryDir), 'snapshots'); }
function ensureMemoryDirs(memoryDir) {
  for (const dir of [episodicDir(memoryDir), semanticDir(memoryDir), workingDir(memoryDir), snapshotsDir(memoryDir)]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
module.exports = { zennoMemoryRoot, episodicDir, semanticDir, workingDir, snapshotsDir, ensureMemoryDirs };
