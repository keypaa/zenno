const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appendEpisodicEntry, readRecentEpisodic } = require('./episodic-memory');
function makeTempMemoryDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-episodic-test-')); }
test('appends and reads back a single entry', () => {
  const dir = makeTempMemoryDir();
  appendEpisodicEntry(dir, { sessionId: 's1', text: 'first note' });
  const entries = readRecentEpisodic(dir);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].text, 'first note');
  assert.ok(entries[0].timestamp);
});
test('readRecentEpisodic returns empty array when nothing has been written', () => {
  const dir = makeTempMemoryDir();
  assert.deepEqual(readRecentEpisodic(dir), []);
});
test('readRecentEpisodic respects the limit, returning the most recent entries', () => {
  const dir = makeTempMemoryDir();
  for (let i = 0; i < 5; i++) { appendEpisodicEntry(dir, { sessionId: 's1', text: `note ${i}` }); }
  const entries = readRecentEpisodic(dir, 2);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].text, 'note 3');
  assert.equal(entries[1].text, 'note 4');
});
test('preserves entries across multiple sessions', () => {
  const dir = makeTempMemoryDir();
  appendEpisodicEntry(dir, { sessionId: 's1', text: 'from session 1' });
  appendEpisodicEntry(dir, { sessionId: 's2', text: 'from session 2' });
  const entries = readRecentEpisodic(dir);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].sessionId, 's1');
  assert.equal(entries[1].sessionId, 's2');
});
