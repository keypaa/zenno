const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeConfigSkeleton } = require('./write-config');

function makeTempRepoWithZennoFolder() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-config-test-'));
  fs.mkdirSync(path.join(repo, 'zenno'));
  return repo;
}

test('writes zenno/config.json with the correct default schema', () => {
  const repo = makeTempRepoWithZennoFolder();
  const result = writeConfigSkeleton(repo);

  assert.equal(result.created, true);
  const written = JSON.parse(fs.readFileSync(result.path, 'utf8'));
  assert.equal(written.version, 1);
  assert.equal(written.agentTeam.depthCap, 3);
  assert.equal(written.agentTeam.concurrentCap, 8);
  assert.equal(written.agentTeam.totalPerTaskCap, 10);
  assert.equal(written.telemetry.enabled, false);
  assert.equal(written.telemetry.recordContent, false);
  assert.ok(written.shield.confidentialFileGuard.denyPatterns.includes('.env'));
  assert.ok(
    written.shield.confidentialFileGuard.allowPatterns.includes('.env.example')
  );
});

test('does not overwrite an existing config.json', () => {
  const repo = makeTempRepoWithZennoFolder();
  const configPath = path.join(repo, 'zenno', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ version: 1, custom: true }));

  const result = writeConfigSkeleton(repo);

  assert.equal(result.created, false);
  const stillThere = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(stillThere.custom, true);
});
