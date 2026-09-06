const test = require('node:test');
const assert = require('node:assert/strict');
const { isOnPath, checkExternalTools } = require('./check-tools');

test('isOnPath returns true for a binary guaranteed to be present (node)', () => {
  assert.equal(isOnPath('node'), true);
});

test('isOnPath returns false for a binary guaranteed not to exist', () => {
  assert.equal(isOnPath('this-binary-definitely-does-not-exist-zenno-test'), false);
});

test('checkExternalTools returns an object with rg and astGrep boolean keys', () => {
  const result = checkExternalTools();
  assert.equal(typeof result.rg, 'boolean');
  assert.equal(typeof result.astGrep, 'boolean');
});
