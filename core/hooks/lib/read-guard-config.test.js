const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readGuardConfig, DEFAULT_DENY_PATTERNS } = require('./read-guard-config');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-guardconfig-test-'));
}

test('falls back to hardcoded defaults when config.json does not exist', () => {
  const repo = makeTempRepo();
  const config = readGuardConfig(repo);

  assert.deepEqual(config.denyPatterns, DEFAULT_DENY_PATTERNS);
  assert.ok(config.denyPatterns.includes('.env'));
});

test('falls back to hardcoded defaults on malformed JSON — fails safe (protected), not open', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), '{ not valid json');

  const config = readGuardConfig(repo);

  assert.deepEqual(config.denyPatterns, DEFAULT_DENY_PATTERNS);
  assert.ok(config.denyPatterns.length > 0, 'must never silently disable protection');
});

test('reads a user-customized deny pattern list from config.json', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({
      shield: { confidentialFileGuard: { denyPatterns: ['my-custom-secret.txt'], allowPatterns: [] } },
    })
  );

  const config = readGuardConfig(repo);

  assert.deepEqual(config.denyPatterns, ['my-custom-secret.txt']);
});

test('reads the configured allow patterns', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({
      shield: { confidentialFileGuard: { denyPatterns: [], allowPatterns: ['.env.ci'] } },
    })
  );

  const config = readGuardConfig(repo);

  assert.deepEqual(config.allowPatterns, ['.env.ci']);
});
