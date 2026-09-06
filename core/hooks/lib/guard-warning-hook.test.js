const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, 'guard-warning-hook.js');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-guard-warning-test-'));
}

function writeJournal(repo, lines) {
  fs.mkdirSync(path.join(repo, 'zenno', 'audit'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'zenno', 'audit', 'journal.jsonl'), lines.join('\n') + '\n', 'utf8');
}

function runHook(repo) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify({ cwd: repo }),
    encoding: 'utf8',
    timeout: 15000,
  });
}

function journalEntries(repo) {
  // The fixture journal deliberately contains a garbage line (the hook must
  // skip it); the reader here skips unparseable lines the same way.
  const p = path.join(repo, 'zenno', 'audit', 'journal.jsonl');
  if (!fs.existsSync(p)) return [];
  const entries = [];
  for (const l of fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean)) {
    try {
      entries.push(JSON.parse(l));
    } catch {
      // skip — mirrors the hook's own per-line tolerance
    }
  }
  return entries;
}

function mixedJournal() {
  return [
    JSON.stringify({ timestamp: '2026-09-06T00:00:00.000Z', type: 'new-dependency', package: 'evil-pkg', ecosystem: 'npm', typosquatSuspected: true, veryRecentlyPublished: false }),
    JSON.stringify({ timestamp: '2026-09-06T00:01:00.000Z', type: 'new-dependency', package: 'left-pad', ecosystem: 'npm', typosquatSuspected: false, veryRecentlyPublished: false }),
    JSON.stringify({ timestamp: '2026-09-06T00:02:00.000Z', type: 'self-mod-warning', path: 'core/hooks/lib/x.js', tier: 'general' }),
    'this line is garbage{{{',
  ];
}

test('one typosquat dep + one self-mod warning yield exactly 2 guard-warning entries', () => {
  const repo = makeTempRepo();
  writeJournal(repo, mixedJournal());
  const result = runHook(repo);
  assert.equal(result.status, 0);
  const warnings = journalEntries(repo).filter((e) => e.type === 'guard-warning');
  assert.equal(warnings.length, 2);
});

test('guardName/result mapping matches the telemetry bridge table', () => {
  const repo = makeTempRepo();
  writeJournal(repo, mixedJournal());
  runHook(repo);
  const warnings = journalEntries(repo).filter((e) => e.type === 'guard-warning');
  const byGuard = {};
  for (const w of warnings) byGuard[w.guardName] = w.result;
  assert.deepEqual(byGuard, { 'provenance-guard': 'block', 'haruspex-guard': 'warn' });
});

test('warning entries carry reason and source timestamp', () => {
  const repo = makeTempRepo();
  writeJournal(repo, mixedJournal());
  runHook(repo);
  const warnings = journalEntries(repo).filter((e) => e.type === 'guard-warning');
  for (const w of warnings) {
    assert.equal(typeof w.reason, 'string');
    assert.equal(typeof w.at, 'string');
    assert.equal(typeof w.timestamp, 'string');
  }
  const reasons = warnings.map((w) => w.reason).sort();
  assert.deepEqual(reasons, ['new-dependency', 'self-mod-warning']);
});

test('second run emits 0 new entries (checkpoint)', () => {
  const repo = makeTempRepo();
  writeJournal(repo, mixedJournal());
  runHook(repo);
  const second = runHook(repo);
  assert.equal(second.status, 0);
  assert.equal(journalEntries(repo).filter((e) => e.type === 'guard-warning').length, 2);
});

test('entries appended after the checkpoint are picked up on the next run', () => {
  const repo = makeTempRepo();
  writeJournal(repo, mixedJournal());
  runHook(repo);
  fs.appendFileSync(
    path.join(repo, 'zenno', 'audit', 'journal.jsonl'),
    JSON.stringify({ timestamp: '2026-09-06T00:03:00.000Z', type: 'self-mod-warning', path: 'y.js', tier: 'general' }) + '\n'
  );
  runHook(repo);
  assert.equal(journalEntries(repo).filter((e) => e.type === 'guard-warning').length, 3);
});

test('missing journal is silent, exit 0', () => {
  const repo = makeTempRepo();
  const result = runHook(repo);
  assert.equal(result.status, 0);
});
