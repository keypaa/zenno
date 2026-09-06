const test = require('node:test');
const assert = require('node:assert/strict');
const { formatMemoryContext } = require('./memory-read-hook');
test('returns empty string when there is nothing to show', () => {
  assert.equal(formatMemoryContext([], []), '');
});
test('formats known facts and recent episodic notes', () => {
  const output = formatMemoryContext([{ text: 'the repo uses PostgreSQL' }], [{ text: 'fixed a flaky test yesterday' }]);
  assert.match(output, /Zenno Memory/);
  assert.match(output, /PostgreSQL/);
  assert.match(output, /flaky test/);
});
test('handles facts with no episodic entries', () => {
  const output = formatMemoryContext([{ text: 'fact only' }], []);
  assert.match(output, /fact only/);
  assert.doesNotMatch(output, /Recent session notes/);
});
