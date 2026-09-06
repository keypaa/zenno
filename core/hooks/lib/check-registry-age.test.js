const test = require('node:test');
const assert = require('node:assert/strict');
const { checkRegistryAge } = require('./check-registry-age');

test('a long-established npm package is not flagged as very recent', async () => {
  const result = await checkRegistryAge('express', 'npm');
  assert.equal(result.checked, true);
  assert.equal(result.veryRecent, false);
  assert.ok(result.createdAt);
});

test('a long-established PyPI package is not flagged as very recent', async () => {
  const result = await checkRegistryAge('requests', 'pip');
  assert.equal(result.checked, true);
  assert.equal(result.veryRecent, false);
  assert.ok(result.createdAt);
});

test('a long-established crates.io package is not flagged as very recent', async () => {
  const result = await checkRegistryAge('serde', 'cargo');
  assert.equal(result.checked, true);
  assert.equal(result.veryRecent, false);
  assert.ok(result.createdAt);
});

test('a nonexistent package reports not-found rather than crashing', async () => {
  const result = await checkRegistryAge('this-package-definitely-does-not-exist-zenno-xyz-123', 'npm');
  assert.equal(result.checked, true);
  assert.equal(result.reason, 'not-found');
});

test('an unsupported ecosystem returns checked:false without attempting a request', async () => {
  const result = await checkRegistryAge('somepkg', 'gem');
  assert.equal(result.checked, false);
  assert.equal(result.reason, 'unsupported-ecosystem');
});

test('a very short timeout falls back gracefully instead of throwing', async () => {
  const result = await checkRegistryAge('express', 'npm', { timeoutMs: 1 });
  assert.equal(result.checked, false);
  assert.equal(result.reason, 'timeout-or-network-error');
});
