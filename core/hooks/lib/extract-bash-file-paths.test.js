const test = require('node:test');
const assert = require('node:assert/strict');
const { extractFilePathsFromBashCommand } = require('./extract-bash-file-paths');

test('extracts a simple cat target', () => {
  assert.deepEqual(extractFilePathsFromBashCommand('cat .env'), ['.env']);
});

test('skips flags, keeps the path', () => {
  assert.deepEqual(extractFilePathsFromBashCommand('cat -n .env'), ['.env']);
});

test('extracts candidates from a chained command', () => {
  const result = extractFilePathsFromBashCommand('cd /tmp && cat .env');
  assert.deepEqual(result, ['.env']);
});

test('extracts from grep — the pattern arg becomes a harmless extra candidate', () => {
  const result = extractFilePathsFromBashCommand('grep API_KEY .env');
  // "API_KEY" is included too since this module doesn't know grep's
  // argument grammar — that's fine, it just won't match any deny pattern.
  assert.deepEqual(result, ['API_KEY', '.env']);
});

test('returns empty array for a command that is not a recognized read command', () => {
  assert.deepEqual(extractFilePathsFromBashCommand('npm install'), []);
  assert.deepEqual(extractFilePathsFromBashCommand('mkdir foo'), []);
});

test('returns empty array for an empty command', () => {
  assert.deepEqual(extractFilePathsFromBashCommand(''), []);
});

test('detects a path-prefixed command like /bin/cat', () => {
  assert.deepEqual(extractFilePathsFromBashCommand('/bin/cat .env'), ['.env']);
  assert.deepEqual(extractFilePathsFromBashCommand('/usr/bin/cat .env'), ['.env']);
});
