// A fixed list of known, meaningful config paths rather than a fully
// generic recursive deep-differ — the schema is well-defined and finite
// (Foundation's defaultConfig()), so walking known paths is simpler and
// more predictable than generic diffing, which would also need to
// handle array-ordering and type-coercion edge cases a fixed-path
// approach avoids entirely.
const KNOWN_PATHS = [
  'shield.confidentialFileGuard.denyPatterns',
  'shield.confidentialFileGuard.allowPatterns',
  'shield.provenanceGuard.typosquatList',
  'shield.provenanceGuard.blockGlobalInstalls',
  'shield.secretScanner.allowlist',
  'agentTeam.depthCap',
  'agentTeam.concurrentCap',
  'agentTeam.totalPerTaskCap',
  'telemetry.enabled',
  'telemetry.recordContent',
  'traces.defaultMode',
];

function getByPath(obj, pathStr) {
  return pathStr.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function diffConfigs(currentConfig, importedConfig) {
  const changes = [];
  for (const p of KNOWN_PATHS) {
    const oldValue = getByPath(currentConfig, p);
    const newValue = getByPath(importedConfig, p);
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ path: p, oldValue, newValue });
    }
  }
  return changes;
}

module.exports = { diffConfigs, getByPath, KNOWN_PATHS };
