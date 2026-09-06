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

// Inverse of getByPath: materializes intermediate objects so callers can
// build a config value from a dotted path without hand-rolling traversal.
function setByPath(obj, pathStr, value) {
  const keys = pathStr.split('.');
  let node = obj;
  for (const k of keys.slice(0, -1)) {
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
    node = node[k];
  }
  node[keys[keys.length - 1]] = value;
  return obj;
}

module.exports = { diffConfigs, getByPath, setByPath, KNOWN_PATHS };
