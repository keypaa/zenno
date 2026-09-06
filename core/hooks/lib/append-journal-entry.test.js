const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appendJournalEntry } = require('./append-journal-entry');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-journal-test-'));
}

test('creates zenno/audit/journal.jsonl when it does not exist yet', () => {
  const repo = makeTempRepo();
  const result = appendJournalEntry(repo, { type: 'new-dependency', package: 'left-pad' });

  assert.ok(fs.existsSync(result.path));
  const lines = fs.readFileSync(result.path, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.type, 'new-dependency');
  assert.equal(parsed.package, 'left-pad');
  assert.ok(parsed.timestamp);
});

test('appends without overwriting existing entries', () => {
  const repo = makeTempRepo();
  appendJournalEntry(repo, { type: 'new-dependency', package: 'first' });
  appendJournalEntry(repo, { type: 'new-dependency', package: 'second' });

  const journalPath = path.join(repo, 'zenno', 'audit', 'journal.jsonl');
  const lines = fs.readFileSync(journalPath, 'utf8').trim().split('\n');

  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).package, 'first');
  assert.equal(JSON.parse(lines[1]).package, 'second');
});

test('each line is independently valid JSON (jsonl format)', () => {
  const repo = makeTempRepo();
  appendJournalEntry(repo, { type: 'a' });
  appendJournalEntry(repo, { type: 'b' });

  const journalPath = path.join(repo, 'zenno', 'audit', 'journal.jsonl');
  const lines = fs.readFileSync(journalPath, 'utf8').trim().split('\n');

  for (const line of lines) {
    assert.doesNotThrow(() => JSON.parse(line));
  }
});
