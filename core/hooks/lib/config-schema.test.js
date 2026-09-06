const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfigSchema } = require('./config-schema');

function validConfig() {
  return {
    version: 1,
    shield: { confidentialFileGuard: { denyPatterns: [], allowPatterns: [] } },
    agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 },
    telemetry: { enabled: false, recordContent: false },
    traces: { defaultMode: 'raw' },
  };
}

test('accepts a well-formed config', () => {
  const result = validateConfigSchema(validConfig());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('rejects a non-object', () => {
  const result = validateConfigSchema('not an object');
  assert.equal(result.valid, false);
});

test('rejects a config missing required top-level keys', () => {
  const config = validConfig();
  delete config.agentTeam;
  const result = validateConfigSchema(config);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /agentTeam/);
});

test('rejects a non-numeric agentTeam cap', () => {
  const config = validConfig();
  config.agentTeam.depthCap = 'three';
  const result = validateConfigSchema(config);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /depthCap must be a number/);
});
