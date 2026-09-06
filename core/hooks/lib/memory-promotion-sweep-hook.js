#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const { readRecentEpisodic } = require('./episodic-memory');
const { readSemanticFacts, appendSemanticFact } = require('./semantic-memory');
const { findCorroboration } = require('./promotion-checker');
const { commitSnapshot } = require('./memory-snapshot');
function readStdinJson() {
  try { const raw = fs.readFileSync(0, 'utf8'); return raw.trim().length > 0 ? JSON.parse(raw) : {}; } catch { return {}; }
}
function runCorroborationSweep(memoryDir) {
  const episodic = readRecentEpisodic(memoryDir, 50);
  const existingFacts = readSemanticFacts(memoryDir);
  const alreadyPromotedTexts = new Set(existingFacts.map((f) => f.text));
  const promoted = [];
  const seen = new Set();
  for (const entry of episodic) {
    if (!entry.text || seen.has(entry.text) || alreadyPromotedTexts.has(entry.text)) continue;
    seen.add(entry.text);
    const corroboration = findCorroboration(episodic, entry.text);
    if (corroboration.corroborated) {
      commitSnapshot(memoryDir, `before promoting (corroborated): ${entry.text.slice(0, 60)}`);
      const fact = appendSemanticFact(memoryDir, { text: entry.text, source: 'cross-session-corroboration', sessionIds: corroboration.sessionIds });
      promoted.push(fact);
    }
  }
  return promoted;
}
function main() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const homeDir = os.homedir();
  const { deriveProjectMemoryDir } = require('../bootstrap-cli');
  const memoryDir = deriveProjectMemoryDir(cwd, homeDir);
  runCorroborationSweep(memoryDir);
  process.exit(0);
}
if (require.main === module) { main(); }
module.exports = { runCorroborationSweep };
