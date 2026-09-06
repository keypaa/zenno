const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rememberEpisodic, rememberSemantic } = require('./memory-remember-cli');
const { readRecentEpisodic } = require('./episodic-memory');
const { readSemanticFacts } = require('./semantic-memory');
function makeTempMemoryDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-remember-test-')); }
test('rememberEpisodic writes an episodic entry', () => {
  const dir = makeTempMemoryDir();
  const result = rememberEpisodic(dir, 'learned something today', 's1');
  assert.equal(result.remembered, true);
  assert.equal(result.layer, 'episodic');
  const entries = readRecentEpisodic(dir);
  assert.equal(entries[0].text, 'learned something today');
});
test('rememberSemantic writes a fact and takes a snapshot first', () => {
  const dir = makeTempMemoryDir();
  const result = rememberSemantic(dir, 'the repo uses PostgreSQL');
  assert.equal(result.remembered, true);
  assert.equal(result.layer, 'semantic');
  assert.ok(result.fact);
  const facts = readSemanticFacts(dir);
  assert.equal(facts.length, 1);
  const gitDir = path.join(dir, 'zenno', 'snapshots', '.git');
  assert.ok(fs.existsSync(gitDir));
});
test('rememberSemantic surfaces contradiction candidates', () => {
  const dir = makeTempMemoryDir();
  rememberSemantic(dir, 'the repo uses PostgreSQL as its database');
  const result = rememberSemantic(dir, 'the repo uses MongoDB as its database');
  assert.equal(result.contradictionCandidates.length, 1);
});
