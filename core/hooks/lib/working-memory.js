const fs = require('node:fs');
const path = require('node:path');
const { workingDir, ensureMemoryDirs } = require('./memory-paths');
function workingStatePath(memoryDir) { return path.join(workingDir(memoryDir), 'state.json'); }
function readWorkingState(memoryDir) {
  const p = workingStatePath(memoryDir);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}
function writeWorkingState(memoryDir, state) {
  ensureMemoryDirs(memoryDir);
  fs.writeFileSync(workingStatePath(memoryDir), JSON.stringify(state, null, 2) + '\n', 'utf8');
}
function clearWorkingState(memoryDir) { writeWorkingState(memoryDir, {}); }
module.exports = { readWorkingState, writeWorkingState, clearWorkingState, workingStatePath };
