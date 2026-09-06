const test = require('node:test');
const assert = require('node:assert/strict');
const { shannonEntropy, findHighEntropyStrings } = require('./entropy-scanner');

test('shannonEntropy is low for a repeated character', () => {
  assert.ok(shannonEntropy('aaaaaaaaaaaaaaaa') < 1);
});

test('shannonEntropy is high for a random-looking string', () => {
  assert.ok(shannonEntropy('xK9$mQ2vL8pR4wZ1nT6bY3jC') > 4);
});

test('flags a high-entropy assignment value', () => {
  const text = 'const secret = "xK9mQ2vL8pR4wZ1nT6bY3jC7hF5dS0aE";';
  const findings = findHighEntropyStrings(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].confidence, 'medium');
  assert.ok(findings[0].entropy >= 4.0);
});

test('does not flag an ordinary sentence-like value', () => {
  const text = 'const description = "this is a normal readable sentence value";';
  const findings = findHighEntropyStrings(text);

  assert.equal(findings.length, 0);
});

test('does not flag short values regardless of content', () => {
  const text = 'const x = "abc123";';
  const findings = findHighEntropyStrings(text);

  assert.equal(findings.length, 0);
});

test('reports the correct line number', () => {
  const text = 'line one\nconst secret = "xK9mQ2vL8pR4wZ1nT6bY3jC7hF5dS0aE";\nline three';
  const findings = findHighEntropyStrings(text);

  assert.equal(findings[0].line, 2);
});

test('catches multiple high-entropy values on the same line', () => {
  const text = 'const a = "xK9mQ2vL8pR4wZ1nT6bY3jC7hF5dS0aE", b = "pQ7wR2tY9uI4oP1aS6dF3gH8jK5lZ0xC";';
  const findings = findHighEntropyStrings(text);

  assert.equal(findings.length, 2);
});
