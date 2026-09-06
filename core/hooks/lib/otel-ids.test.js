const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTraceId, generateSpanId } = require('./otel-ids');

test('generateTraceId produces a 32-character hex string', () => {
  const id = generateTraceId();
  assert.equal(id.length, 32);
  assert.match(id, /^[0-9a-f]{32}$/);
});

test('generateSpanId produces a 16-character hex string', () => {
  const id = generateSpanId();
  assert.equal(id.length, 16);
  assert.match(id, /^[0-9a-f]{16}$/);
});

test('generates distinct IDs on repeated calls', () => {
  const a = generateTraceId();
  const b = generateTraceId();
  assert.notEqual(a, b);
});
