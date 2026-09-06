const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCorroborationSweep } = require('./memory-promotion-sweep-hook');
const { appendEpisodicEntry } = require('./episodic-memory');
const { readSemanticFacts } = require('./semantic-memory');
function makeTempMemoryDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-sweep-test-')); }
test('promotes a near-verbatim claim corroborated across 2 distinct sessions', () => {
  const dir = makeTempMemoryDir();
  appendEpisodicEntry(dir, { sessionId: 's1', text: 'the repo uses PostgreSQL as its database' });
  appendEpisodicEntry(dir, { sessionId: 's2', text: 'confirmed the repo uses PostgreSQL as its database' });
  const promoted = runCorroborationSweep(dir);
  assert.equal(promoted.length > 0, true);
  const facts = readSemanticFacts(dir);
  assert.ok(facts.length > 0);
});
test('does not promote a claim from a single session', () => {
  const dir = makeTempMemoryDir();
  appendEpisodicEntry(dir, { sessionId: 's1', text: 'the repo uses PostgreSQL' });
  const promoted = runCorroborationSweep(dir);
  assert.equal(promoted.length, 0);
});
test('does not re-promote an already-promoted fact', () => {
  const dir = makeTempMemoryDir();
  appendEpisodicEntry(dir, { sessionId: 's1', text: 'the repo uses PostgreSQL as its database' });
  appendEpisodicEntry(dir, { sessionId: 's2', text: 'the repo uses PostgreSQL as its database' });
  const first = runCorroborationSweep(dir);
  assert.equal(first.length, 1);
  const second = runCorroborationSweep(dir);
  assert.equal(second.length, 0);
});
