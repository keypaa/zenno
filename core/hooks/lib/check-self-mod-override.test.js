const test = require('node:test');
const assert = require('node:assert/strict');
const { isOverrideActive, OVERRIDE_ENV_VAR } = require('./check-self-mod-override');

test('override is inactive by default (no env var set)', () => {
  assert.equal(isOverrideActive({}), false);
});

test('override is active when the env var is exactly "1"', () => {
  assert.equal(isOverrideActive({ [OVERRIDE_ENV_VAR]: '1' }), true);
});

test('override is inactive for any value other than exactly "1"', () => {
  assert.equal(isOverrideActive({ [OVERRIDE_ENV_VAR]: 'true' }), false);
  assert.equal(isOverrideActive({ [OVERRIDE_ENV_VAR]: 'yes' }), false);
  assert.equal(isOverrideActive({ [OVERRIDE_ENV_VAR]: '0' }), false);
});
