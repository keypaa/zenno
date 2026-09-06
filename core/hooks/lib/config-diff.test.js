const test = require('node:test');
const assert = require('node:assert/strict');
const { diffConfigs } = require('./config-diff');

test('reports no changes for identical configs', () => {
  const config = { agentTeam: { depthCap: 3 } };
  assert.deepEqual(diffConfigs(config, config), []);
});

test('reports a changed numeric field', () => {
  const current = { agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 } };
  const imported = { agentTeam: { depthCap: 5, concurrentCap: 8, totalPerTaskCap: 10 } };
  const changes = diffConfigs(current, imported);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].path, 'agentTeam.depthCap');
  assert.equal(changes[0].oldValue, 3);
  assert.equal(changes[0].newValue, 5);
});

test('reports a changed array field', () => {
  const current = { shield: { confidentialFileGuard: { denyPatterns: ['.env'] } } };
  const imported = { shield: { confidentialFileGuard: { denyPatterns: ['.env', '*.pem'] } } };
  const changes = diffConfigs(current, imported);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].path, 'shield.confidentialFileGuard.denyPatterns');
});

test('handles missing fields on either side without crashing', () => {
  const changes = diffConfigs({}, { agentTeam: { depthCap: 3 } });
  assert.ok(changes.some((c) => c.path === 'agentTeam.depthCap'));
});
