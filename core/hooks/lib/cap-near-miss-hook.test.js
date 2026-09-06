const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, 'cap-near-miss-hook.js');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-cap-near-miss-test-'));
}

function writeCaps(repo, totalCap) {
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({
      version: 1,
      shield: {},
      agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: totalCap },
      telemetry: { enabled: false, recordContent: false },
      traces: { defaultMode: 'raw' },
    })
  );
}

function writeState(repo, spawned) {
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'zenno', '.agent-team-state.json'),
    JSON.stringify({ totalSpawned: spawned, currentActive: 0, depthByAgentId: {}, pendingDepthStack: [] })
  );
}

function runHook(repo) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify({ cwd: repo }),
    encoding: 'utf8',
    timeout: 15000,
  });
}

function journalEntries(repo) {
  const p = path.join(repo, 'zenno', 'audit', 'journal.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('state 8/10 appends one cap-near-miss entry with proximity 0.8', () => {
  const repo = makeTempRepo();
  writeCaps(repo, 10);
  writeState(repo, 8);
  const result = runHook(repo);
  assert.equal(result.status, 0);
  const entries = journalEntries(repo).filter((e) => e.type === 'cap-near-miss');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].spawned, 8);
  assert.equal(entries[0].totalCap, 10);
  assert.equal(entries[0].proximity, 0.8);
  assert.deepEqual(Object.keys(entries[0].caps).sort(), ['concurrentCap', 'depthCap', 'totalPerTaskCap']);
});

test('second run with unchanged state appends no second entry (marker)', () => {
  const repo = makeTempRepo();
  writeCaps(repo, 10);
  writeState(repo, 8);
  runHook(repo);
  const second = runHook(repo);
  assert.equal(second.status, 0);
  assert.equal(journalEntries(repo).filter((e) => e.type === 'cap-near-miss').length, 1);
});

test('a further spawn after the marker appends a fresh entry', () => {
  const repo = makeTempRepo();
  writeCaps(repo, 10);
  writeState(repo, 8);
  runHook(repo);
  writeState(repo, 9);
  runHook(repo);
  const entries = journalEntries(repo).filter((e) => e.type === 'cap-near-miss');
  assert.equal(entries.length, 2);
  assert.equal(entries[1].spawned, 9);
  assert.equal(entries[1].proximity, 0.9);
});

test('state 3/10 is silent, no entry', () => {
  const repo = makeTempRepo();
  writeCaps(repo, 10);
  writeState(repo, 3);
  const result = runHook(repo);
  assert.equal(result.status, 0);
  assert.equal(journalEntries(repo).length, 0);
});

test('state 10/10 is silent — tripped, not a near miss', () => {
  const repo = makeTempRepo();
  writeCaps(repo, 10);
  writeState(repo, 10);
  const result = runHook(repo);
  assert.equal(result.status, 0);
  assert.equal(journalEntries(repo).length, 0);
});

test('missing state file on a fresh repo is silent, exit 0', () => {
  const repo = makeTempRepo();
  writeCaps(repo, 10);
  const result = runHook(repo);
  assert.equal(result.status, 0);
  assert.equal(journalEntries(repo).length, 0);
});

test('entry carries the full caps snapshot for later diagnosis', () => {
  const repo = makeTempRepo();
  writeCaps(repo, 10);
  writeState(repo, 8);
  runHook(repo);
  const entry = journalEntries(repo).find((e) => e.type === 'cap-near-miss');
  assert.deepEqual(entry.caps, { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 });
  assert.equal(typeof entry.timestamp, 'string');
});

test('malformed marker file is treated as unseen, still exits 0', () => {
  const repo = makeTempRepo();
  writeCaps(repo, 10);
  writeState(repo, 8);
  fs.mkdirSync(path.join(repo, 'zenno', 'audit'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'zenno', 'audit', '.cap-near-miss-seen.json'), '{{{bad');
  const result = runHook(repo);
  assert.equal(result.status, 0);
  assert.equal(journalEntries(repo).filter((e) => e.type === 'cap-near-miss').length, 1);
});
