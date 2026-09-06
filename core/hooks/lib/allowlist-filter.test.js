const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readAllowlist, filterAllowlisted } = require('./allowlist-filter');

function makeTempRepoWithConfig(allowlist) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-allowlist-test-'));
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ shield: { secretScanner: { allowlist } } })
  );
  return repo;
}

test('readAllowlist returns an empty array when config.json does not exist', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-noconfig-test-'));
  assert.deepEqual(readAllowlist(repo), []);
});

test('readAllowlist returns an empty array on malformed JSON — fails closed, not open', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-badconfig-test-'));
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), '{ not valid json');

  assert.deepEqual(readAllowlist(repo), []);
});

test('readAllowlist reads the configured allowlist entries', () => {
  const repo = makeTempRepoWithConfig(['AKIAFAKEEXAMPLEKEY12']);
  assert.deepEqual(readAllowlist(repo), ['AKIAFAKEEXAMPLEKEY12']);
});

test('filterAllowlisted removes findings matching an allowlist entry', () => {
  const findings = [
    { type: 'aws-access-key-id', matchedText: 'AKIAFAKEEXAMPLEKEY12', line: 1 },
    { type: 'github-pat', matchedText: 'ghp_realsecrettoken1234567890', line: 2 },
  ];
  const result = filterAllowlisted(findings, ['AKIAFAKEEXAMPLEKEY12']);

  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'github-pat');
});

test('filterAllowlisted is a no-op when the allowlist is empty', () => {
  const findings = [{ type: 'aws-access-key-id', matchedText: 'AKIAFAKEEXAMPLEKEY12', line: 1 }];
  const result = filterAllowlisted(findings, []);

  assert.equal(result.length, 1);
});
