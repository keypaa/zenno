const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { syncJournalToTelemetry, isGuardFiringEntry } = require('./journal-telemetry-bridge');
const { appendJournalEntry } = require('./append-journal-entry');
const { telemetryFilePath } = require('./otlp-file-exporter');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-journalbridge-test-'));
}

test('isGuardFiringEntry recognizes self-mod warnings', () => {
  assert.equal(isGuardFiringEntry({ type: 'self-mod-warning' }), true);
});

test('isGuardFiringEntry recognizes a typosquat-suspected new dependency', () => {
  assert.equal(isGuardFiringEntry({ type: 'new-dependency', typosquatSuspected: true }), true);
});

test('isGuardFiringEntry does NOT flag a routine, clean new dependency', () => {
  assert.equal(isGuardFiringEntry({ type: 'new-dependency', typosquatSuspected: false, veryRecentlyPublished: false }), false);
});

test('syncs a guard-firing journal entry into a telemetry span', () => {
  const repo = makeTempRepo();
  appendJournalEntry(repo, { type: 'self-mod-warning', path: 'core/skills/foo.md', tier: 'general' });

  const result = syncJournalToTelemetry(repo);
  assert.equal(result.synced, 1);
  assert.ok(fs.existsSync(telemetryFilePath(repo)));
});

test('does not re-sync entries already processed (checkpoint works)', () => {
  const repo = makeTempRepo();
  appendJournalEntry(repo, { type: 'self-mod-warning', path: 'a' });
  syncJournalToTelemetry(repo);

  const second = syncJournalToTelemetry(repo);
  assert.equal(second.synced, 0);
});

test('syncs only NEW entries added after the last checkpoint', () => {
  const repo = makeTempRepo();
  appendJournalEntry(repo, { type: 'self-mod-warning', path: 'a' });
  syncJournalToTelemetry(repo);

  appendJournalEntry(repo, { type: 'self-mod-warning', path: 'b' });
  const result = syncJournalToTelemetry(repo);
  assert.equal(result.synced, 1);
});

test('returns synced: 0 when no journal exists yet', () => {
  const repo = makeTempRepo();
  assert.deepEqual(syncJournalToTelemetry(repo), { synced: 0 });
});
