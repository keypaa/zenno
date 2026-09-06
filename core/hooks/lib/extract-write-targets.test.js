const test = require('node:test');
const assert = require('node:assert/strict');
const { extractWriteTargetsFromBashCommand } = require('./extract-write-targets');

test('extracts both source and destination from mv', () => {
  const result = extractWriteTargetsFromBashCommand('mv a.txt core/hooks/hooks.json');
  assert.deepEqual(result, ['a.txt', 'core/hooks/hooks.json']);
});

test('extracts the target from rm', () => {
  const result = extractWriteTargetsFromBashCommand('rm core/hooks/hooks.json');
  assert.deepEqual(result, ['core/hooks/hooks.json']);
});

test('extracts the destination from cp', () => {
  const result = extractWriteTargetsFromBashCommand('cp evil.json core/hooks/hooks.json');
  assert.deepEqual(result, ['evil.json', 'core/hooks/hooks.json']);
});

test('extracts the target from sed -i (in-place edit)', () => {
  const result = extractWriteTargetsFromBashCommand("sed -i 's/x/y/' core/hooks/hooks.json");
  assert.ok(result.includes('core/hooks/hooks.json'));
});

test('does not flag plain sed without -i (reads, does not write)', () => {
  const result = extractWriteTargetsFromBashCommand("sed 's/x/y/' core/hooks/hooks.json");
  assert.deepEqual(result, []);
});

test('detects a single-arrow redirect target', () => {
  const result = extractWriteTargetsFromBashCommand('echo malicious > core/hooks/hooks.json');
  assert.ok(result.includes('core/hooks/hooks.json'));
});

test('detects a double-arrow (append) redirect target', () => {
  const result = extractWriteTargetsFromBashCommand('echo more >> core/hooks/hooks.json');
  assert.ok(result.includes('core/hooks/hooks.json'));
});

test('extracts candidates from a chained command', () => {
  const result = extractWriteTargetsFromBashCommand('cd /tmp && rm core/hooks/hooks.json');
  assert.ok(result.includes('core/hooks/hooks.json'));
});

test('returns empty array for a command with no write operation at all', () => {
  assert.deepEqual(extractWriteTargetsFromBashCommand('cat core/hooks/hooks.json'), []);
  assert.deepEqual(extractWriteTargetsFromBashCommand('npm test'), []);
});
