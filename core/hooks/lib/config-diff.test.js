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

test('setByPath creates nested objects from a flat dotted path', () => {
  const { setByPath } = require('./config-diff');
  assert.deepEqual(setByPath({}, 'shield.secretScanner.allowlist', ['x']), {
    shield: { secretScanner: { allowlist: ['x'] } },
  });
});

test('setByPath overwrites a scalar leaf without disturbing siblings', () => {
  const { setByPath } = require('./config-diff');
  const obj = { agentTeam: { depthCap: 3, concurrentCap: 8 } };
  setByPath(obj, 'agentTeam.depthCap', 5);
  assert.deepEqual(obj, { agentTeam: { depthCap: 5, concurrentCap: 8 } });
});

test('setByPath replaces a non-object intermediate', () => {
  const { setByPath } = require('./config-diff');
  const obj = { traces: 'raw' };
  setByPath(obj, 'traces.targetDir', 'zenno/traces');
  assert.deepEqual(obj, { traces: { targetDir: 'zenno/traces' } });
});
