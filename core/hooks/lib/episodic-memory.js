const fs = require('node:fs');
const path = require('node:path');
const { episodicDir, ensureMemoryDirs } = require('./memory-paths');
function episodicLogPath(memoryDir) { return path.join(episodicDir(memoryDir), 'log.jsonl'); }
function appendEpisodicEntry(memoryDir, entry) {
  ensureMemoryDirs(memoryDir);
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  fs.appendFileSync(episodicLogPath(memoryDir), line + '\n', 'utf8');
}
function readRecentEpisodic(memoryDir, limit = 10) {
  const p = episodicLogPath(memoryDir);
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map((l) => JSON.parse(l));
}
module.exports = { appendEpisodicEntry, readRecentEpisodic, episodicLogPath };
