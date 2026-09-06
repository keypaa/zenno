const test = require('node:test');
const assert = require('node:assert/strict');
const { isSecurityRelevant, classifyChanges } = require('./security-relevant-change-detector');

test('flags removing a deny pattern as security-relevant', () => {
  const change = { path: 'shield.confidentialFileGuard.denyPatterns', oldValue: ['.env', '*.pem'], newValue: ['.env'] };
  assert.equal(isSecurityRelevant(change), true);
});

test('does not flag adding a deny pattern (more restrictive, not weaker)', () => {
  const change = { path: 'shield.confidentialFileGuard.denyPatterns', oldValue: ['.env'], newValue: ['.env', '*.pem'] };
  assert.equal(isSecurityRelevant(change), false);
});

test('flags disabling blockGlobalInstalls as security-relevant', () => {
  const change = { path: 'shield.provenanceGuard.blockGlobalInstalls', oldValue: true, newValue: false };
  assert.equal(isSecurityRelevant(change), true);
});

test('flags raising an agentTeam cap as security-relevant', () => {
  const change = { path: 'agentTeam.depthCap', oldValue: 3, newValue: 10 };
  assert.equal(isSecurityRelevant(change), true);
});

test('does not flag lowering an agentTeam cap (more restrictive)', () => {
  const change = { path: 'agentTeam.depthCap', oldValue: 3, newValue: 1 };
  assert.equal(isSecurityRelevant(change), false);
});

test('flags enabling telemetry content recording as security-relevant', () => {
  const change = { path: 'telemetry.recordContent', oldValue: false, newValue: true };
  assert.equal(isSecurityRelevant(change), true);
});

test('does not flag an unrelated field change', () => {
  const change = { path: 'traces.defaultMode', oldValue: 'raw', newValue: 'curated' };
  assert.equal(isSecurityRelevant(change), false);
});

test('classifyChanges splits a mixed list correctly', () => {
  const changes = [
    { path: 'agentTeam.depthCap', oldValue: 3, newValue: 10 },
    { path: 'traces.defaultMode', oldValue: 'raw', newValue: 'curated' },
  ];
  const result = classifyChanges(changes);
  assert.equal(result.securityRelevant.length, 1);
  assert.equal(result.general.length, 1);
});

// Regression: the first pass of this detector covered denyPatterns,
// blockGlobalInstalls, caps, and recordContent but silently returned
// false for typosquatList and allowPatterns — both are paths KNOWN_PATHS
// already diffs, so a weakening change there would have imported without
// any flag at all.
test('regression: flags removing a typosquatList entry (package loses protection)', () => {
  const change = { path: 'shield.provenanceGuard.typosquatList', oldValue: ['fake-pkg'], newValue: [] };
  assert.equal(isSecurityRelevant(change), true);
});

test('regression: does not flag adding a typosquatList entry (more protective)', () => {
  const change = { path: 'shield.provenanceGuard.typosquatList', oldValue: [], newValue: ['fake-pkg'] };
  assert.equal(isSecurityRelevant(change), false);
});

test('regression: flags adding a confidentialFileGuard allowPattern (widens what reads are allowed)', () => {
  const change = { path: 'shield.confidentialFileGuard.allowPatterns', oldValue: [], newValue: ['*.env'] };
  assert.equal(isSecurityRelevant(change), true);
});

test('regression: does not flag removing an allowPattern (tightens the guard)', () => {
  const change = { path: 'shield.confidentialFileGuard.allowPatterns', oldValue: ['*.env'], newValue: [] };
  assert.equal(isSecurityRelevant(change), false);
});
