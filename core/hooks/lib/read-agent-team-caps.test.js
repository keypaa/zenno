const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readAgentTeamCaps, DEFAULT_CAPS } = require('./read-agent-team-caps');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-agentcaps-test-'));
}

test('falls back to hardcoded defaults when config.json does not exist', () => {
  const repo = makeTempRepo();
  assert.deepEqual(readAgentTeamCaps(repo), DEFAULT_CAPS);
});

test('falls back to hardcoded defaults on malformed JSON — fails safe, not open', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), '{ bad json');

  assert.deepEqual(readAgentTeamCaps(repo), DEFAULT_CAPS);
});

test('reads user-customized caps from config.json', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ agentTeam: { depthCap: 2, concurrentCap: 4, totalPerTaskCap: 6 } })
  );

  assert.deepEqual(readAgentTeamCaps(repo), { depthCap: 2, concurrentCap: 4, totalPerTaskCap: 6 });
});

test('falls back per-field to defaults when only some caps are customized', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ agentTeam: { depthCap: 1 } })
  );

  const caps = readAgentTeamCaps(repo);
  assert.equal(caps.depthCap, 1);
  assert.equal(caps.concurrentCap, DEFAULT_CAPS.concurrentCap);
  assert.equal(caps.totalPerTaskCap, DEFAULT_CAPS.totalPerTaskCap);
});
