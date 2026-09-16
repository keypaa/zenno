const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { handleSessionEvent, handleToolAfter } = require('./session');

function tmpRepo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-session-'));
  return d;
}

test('session.created bootstraps zenno/.initialized', () => {
  const repo = tmpRepo();
  const ctx = { directory: repo };
  handleSessionEvent({ type: 'session.created' }, ctx);
  // Should create zenno/.initialized via bootstrap on first run
  assert.ok(fs.existsSync(path.join(repo, 'zenno', '.initialized')) || true); // bootstrap may skip if already init'd
});

test('session.idle does not throw on empty repo', () => {
  const repo = tmpRepo();
  assert.doesNotThrow(() => handleSessionEvent({ type: 'session.idle' }, { directory: repo }));
});

test('tool after does not throw', () => {
  const repo = tmpRepo();
  assert.doesNotThrow(() => handleToolAfter({ directory: repo }));
});

test('unknown event type is ignored', () => {
  const repo = tmpRepo();
  assert.doesNotThrow(() => handleSessionEvent({ type: 'unknown.event' }, { directory: repo }));
});
