const test = require('node:test');
const assert = require('node:assert/strict');
const { redactSecrets, REDACTION_PLACEHOLDER } = require('./trace-secret-redaction');

test('redacts a high-confidence pattern match', () => {
  const { redactedText, redactedCount } = redactSecrets('{"command":"export KEY=AKIAIOSFODNN7EXAMPLE"}');
  assert.doesNotMatch(redactedText, /AKIAIOSFODNN7EXAMPLE/);
  assert.match(redactedText, new RegExp(REDACTION_PLACEHOLDER.replace(/[[\]]/g, '\\$&')));
  assert.equal(redactedCount, 1);
});

test('redacts a medium-confidence entropy match too (wider net than the Secret Scanner guard)', () => {
  const { redactedText, redactedCount } = redactSecrets('{"secret":"xK9mQ2vL8pR4wZ1nT6bY3jC7hF5dS0aE"}');
  assert.doesNotMatch(redactedText, /xK9mQ2vL8pR4wZ1nT6bY3jC7hF5dS0aE/);
  assert.equal(redactedCount, 1);
});

test('leaves clean text completely unchanged', () => {
  const original = '{"message":"just a normal conversation turn"}';
  const { redactedText, redactedCount } = redactSecrets(original);
  assert.equal(redactedText, original);
  assert.equal(redactedCount, 0);
});

test('redacts every occurrence of the same secret value across multiple lines', () => {
  const text = 'line one AKIAIOSFODNN7EXAMPLE\nline two AKIAIOSFODNN7EXAMPLE';
  const { redactedText } = redactSecrets(text);
  assert.doesNotMatch(redactedText, /AKIAIOSFODNN7EXAMPLE/);
  const occurrences = (redactedText.match(/\[ZENNO-REDACTED-SECRET\]/g) || []).length;
  assert.equal(occurrences, 2);
});
