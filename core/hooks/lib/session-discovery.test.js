const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listSessionFiles } = require('./session-discovery');

function makeTempSessionsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-sessions-test-'));
}

test('returns empty array when the sessions directory does not exist', () => {
  assert.deepEqual(listSessionFiles('/nonexistent/path/xyz'), []);
});

test('lists .jsonl files, sorted', () => {
  const dir = makeTempSessionsDir();
  fs.writeFileSync(path.join(dir, 'session-b.jsonl'), '{}');
  fs.writeFileSync(path.join(dir, 'session-a.jsonl'), '{}');
  const files = listSessionFiles(dir);
  assert.equal(files.length, 2);
  assert.ok(files[0].endsWith('session-a.jsonl'));
  assert.ok(files[1].endsWith('session-b.jsonl'));
});

test('ignores non-.jsonl files and subdirectories (like memory/)', () => {
  const dir = makeTempSessionsDir();
  fs.writeFileSync(path.join(dir, 'session-a.jsonl'), '{}');
  fs.writeFileSync(path.join(dir, 'readme.txt'), 'hi');
  fs.mkdirSync(path.join(dir, 'memory'));
  fs.writeFileSync(path.join(dir, 'memory', 'zenno-data.jsonl'), '{}');

  const files = listSessionFiles(dir);
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith('session-a.jsonl'));
});
