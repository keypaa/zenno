#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const { readSemanticFacts } = require('./semantic-memory');
const { readRecentEpisodic } = require('./episodic-memory');
function readStdinJson() {
  try { const raw = fs.readFileSync(0, 'utf8'); return raw.trim().length > 0 ? JSON.parse(raw) : {}; } catch { return {}; }
}
function formatMemoryContext(facts, episodic) {
  if (facts.length === 0 && episodic.length === 0) return '';
  const lines = ['=== Zenno Memory ==='];
  if (facts.length > 0) { lines.push('Known project facts:'); for (const f of facts) lines.push(`- ${f.text}`); }
  if (episodic.length > 0) { lines.push('Recent session notes:'); for (const e of episodic) lines.push(`- ${e.text || JSON.stringify(e)}`); }
  lines.push('=== End Zenno Memory ===');
  return lines.join('\n');
}
function main() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const homeDir = os.homedir();
  const { deriveProjectMemoryDir } = require('../bootstrap-cli');
  const memoryDir = deriveProjectMemoryDir(cwd, homeDir);
  const facts = readSemanticFacts(memoryDir);
  const episodic = readRecentEpisodic(memoryDir, 10);
  const context = formatMemoryContext(facts, episodic);
  if (context) process.stdout.write(context + '\n');
  process.exit(0);
}
if (require.main === module) { main(); }
module.exports = { formatMemoryContext };
