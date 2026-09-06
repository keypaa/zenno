#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const { appendEpisodicEntry } = require('./episodic-memory');
const { appendSemanticFact, readSemanticFacts, findContradictionCandidates } = require('./semantic-memory');
const { commitSnapshot } = require('./memory-snapshot');
function readStdinJson() {
  try { const raw = fs.readFileSync(0, 'utf8'); return raw.trim().length > 0 ? JSON.parse(raw) : {}; } catch { return {}; }
}
function rememberEpisodic(memoryDir, text, sessionId) {
  appendEpisodicEntry(memoryDir, { sessionId: sessionId || 'unknown-session', text });
  return { remembered: true, layer: 'episodic' };
}
function rememberSemantic(memoryDir, text, source = 'explicit') {
  const existingFacts = readSemanticFacts(memoryDir);
  const contradictionCandidates = findContradictionCandidates(existingFacts, text);
  commitSnapshot(memoryDir, `before explicit promotion: ${text.slice(0, 60)}`);
  const fact = appendSemanticFact(memoryDir, { text, source });
  return { remembered: true, layer: 'semantic', fact, contradictionCandidates };
}
function main() {
  const mode = process.argv[2];
  const text = process.argv[3];
  if ((mode !== '--episodic' && mode !== '--semantic') || !text) {
    process.stderr.write('Usage: memory-remember-cli.js --episodic|--semantic "text to remember"\n');
    process.exit(1);
  }
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const homeDir = os.homedir();
  const { deriveProjectMemoryDir } = require('../bootstrap-cli');
  const memoryDir = deriveProjectMemoryDir(cwd, homeDir);
  const result = mode === '--episodic' ? rememberEpisodic(memoryDir, text, payload.session_id) : rememberSemantic(memoryDir, text);
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(0);
}
if (require.main === module) { main(); }
module.exports = { rememberEpisodic, rememberSemantic };
