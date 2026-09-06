const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readWorkingState, writeWorkingState, clearWorkingState } = require('./working-memory');
function makeTempMemoryDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-working-test-')); }
test('readWorkingState returns empty object when nothing has been written', () => {
  const dir = makeTempMemoryDir();
  assert.deepEqual(readWorkingState(dir), {});
});
test('round-trips a written state', () => {
  const dir = makeTempMemoryDir();
  writeWorkingState(dir, { currentTask: 'refactor auth' });
  assert.deepEqual(readWorkingState(dir), { currentTask: 'refactor auth' });
});
test('clearWorkingState resets to empty object', () => {
  const dir = makeTempMemoryDir();
  writeWorkingState(dir, { currentTask: 'refactor auth' });
  clearWorkingState(dir);
  assert.deepEqual(readWorkingState(dir), {});
});
test('falls back to empty object on malformed state file', () => {
  const dir = makeTempMemoryDir();
  fs.mkdirSync(path.join(dir, 'zenno', 'working'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'zenno', 'working', 'state.json'), '{ bad json');
  assert.deepEqual(readWorkingState(dir), {});
});
