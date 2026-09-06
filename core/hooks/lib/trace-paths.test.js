const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { deriveProjectSessionsDir, tracesOutputDir, rawTracesDir } = require('./trace-paths');

test('deriveProjectSessionsDir is the parent of the memory directory', () => {
  const result = deriveProjectSessionsDir('/home/user/my-project', '/home/user');
  assert.equal(path.basename(result), '-home-user-my-project');
  assert.doesNotMatch(result, /memory$/);
});

test('tracesOutputDir and rawTracesDir compute expected paths', () => {
  assert.equal(tracesOutputDir('/repo'), path.join('/repo', 'zenno', 'traces'));
  assert.equal(rawTracesDir('/repo'), path.join('/repo', 'zenno', 'traces', 'raw'));
});
