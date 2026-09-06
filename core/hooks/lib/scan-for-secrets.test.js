const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scanForSecrets } = require('./scan-for-secrets');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-scanforSecrets-test-'));
}

function makeTempRepoWithAllowlist(allowlist) {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ shield: { secretScanner: { allowlist } } })
  );
  return repo;
}

test('flags a high-confidence pattern match', () => {
  const repo = makeTempRepo();
  const result = scanForSecrets('const key = "AKIAIOSFODNN7EXAMPLE";', repo);

  assert.equal(result.hasHighConfidenceMatch, true);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].confidence, 'high');
});

test('a medium-confidence entropy-only finding does not set hasHighConfidenceMatch', () => {
  const repo = makeTempRepo();
  const result = scanForSecrets(
    'const secret = "xK9mQ2vL8pR4wZ1nT6bY3jC7hF5dS0aE";',
    repo
  );

  assert.equal(result.hasHighConfidenceMatch, false);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].confidence, 'medium');
});

test('clean text with no secrets produces no findings', () => {
  const repo = makeTempRepo();
  const result = scanForSecrets('function add(a, b) { return a + b; }', repo);

  assert.equal(result.hasHighConfidenceMatch, false);
  assert.equal(result.findings.length, 0);
});

test('an allowlisted match is excluded and no longer trips hasHighConfidenceMatch', () => {
  const repo = makeTempRepoWithAllowlist(['AKIAIOSFODNN7EXAMPLE']);
  const result = scanForSecrets('const key = "AKIAIOSFODNN7EXAMPLE";', repo);

  assert.equal(result.hasHighConfidenceMatch, false);
  assert.equal(result.findings.length, 0);
});

test('combines multiple finding types from the same text', () => {
  const repo = makeTempRepo();
  const text = [
    'const aws = "AKIAIOSFODNN7EXAMPLE";',
    'const random = "xK9mQ2vL8pR4wZ1nT6bY3jC7hF5dS0aE";',
  ].join('\n');
  const result = scanForSecrets(text, repo);

  assert.equal(result.findings.length, 2);
  assert.equal(result.hasHighConfidenceMatch, true);
});
