const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readSemanticFacts, appendSemanticFact, findContradictionCandidates } = require('./semantic-memory');
function makeTempMemoryDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-semantic-test-')); }
test('appends and reads back a fact with metadata', () => {
  const dir = makeTempMemoryDir();
  const fact = appendSemanticFact(dir, { text: 'the repo uses PostgreSQL', source: 'explicit' });
  assert.equal(fact.text, 'the repo uses PostgreSQL');
  assert.equal(fact.source, 'explicit');
  assert.ok(fact.createdAt);
  const facts = readSemanticFacts(dir);
  assert.equal(facts.length, 1);
  assert.equal(facts[0].text, 'the repo uses PostgreSQL');
});
test('readSemanticFacts returns empty array when nothing has been written', () => {
  const dir = makeTempMemoryDir();
  assert.deepEqual(readSemanticFacts(dir), []);
});
test('finds a contradiction candidate via keyword overlap', () => {
  const existing = [{ text: 'the repo uses PostgreSQL as its database' }];
  const candidates = findContradictionCandidates(existing, 'the repo uses MongoDB as its database');
  assert.equal(candidates.length, 1);
});
test('does not flag unrelated facts as contradiction candidates', () => {
  const existing = [{ text: 'the repo uses PostgreSQL as its database' }];
  const candidates = findContradictionCandidates(existing, 'the CI pipeline runs on GitHub Actions');
  assert.equal(candidates.length, 0);
});
