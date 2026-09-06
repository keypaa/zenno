const test = require('node:test');
const assert = require('node:assert/strict');
const { findPatternMatches } = require('./detect-secret-patterns');

test('detects an AWS access key ID', () => {
  const text = 'const key = "AKIAIOSFODNN7EXAMPLE";';
  const findings = findPatternMatches(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'aws-access-key-id');
  assert.equal(findings[0].confidence, 'high');
  assert.equal(findings[0].line, 1);
});

test('detects a GitHub personal access token', () => {
  const text = 'TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz';
  const findings = findPatternMatches(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'github-pat');
});

test('detects a private key block', () => {
  const text = '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----';
  const findings = findPatternMatches(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'private-key-block');
});

test('reports the correct line number for a match on a later line', () => {
  const text = 'line one\nline two\nconst key = "AKIAIOSFODNN7EXAMPLE";\nline four';
  const findings = findPatternMatches(text);

  assert.equal(findings[0].line, 3);
});

test('finds multiple distinct matches in the same text', () => {
  const text = [
    'const aws = "AKIAIOSFODNN7EXAMPLE";',
    'const gh = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";',
  ].join('\n');
  const findings = findPatternMatches(text);

  assert.equal(findings.length, 2);
});

test('returns no findings for ordinary code with no secrets', () => {
  const text = 'function add(a, b) {\n  return a + b;\n}\nconst apiUrl = "https://example.com/api";';
  const findings = findPatternMatches(text);

  assert.equal(findings.length, 0);
});
