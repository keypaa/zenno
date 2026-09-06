const REQUIRED_TOP_LEVEL_KEYS = ['version', 'shield', 'agentTeam', 'telemetry', 'traces'];

// Lightweight structural validation, not a full JSON-schema library —
// consistent with this project's zero-new-dependencies principle. Checks
// required top-level keys exist and that the fields most likely to be
// hand-edited incorrectly (the numeric caps) actually have the right
// type, rather than validating every nested field exhaustively.
function validateConfigSchema(config) {
  const errors = [];
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return { valid: false, errors: ['config is not an object'] };
  }
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in config)) errors.push(`missing required top-level key: ${key}`);
  }
  if ('shield' in config && (typeof config.shield !== 'object' || config.shield === null)) {
    errors.push('shield must be an object');
  }
  if (config.agentTeam && typeof config.agentTeam === 'object') {
    for (const capKey of ['depthCap', 'concurrentCap', 'totalPerTaskCap']) {
      if (capKey in config.agentTeam && typeof config.agentTeam[capKey] !== 'number') {
        errors.push(`agentTeam.${capKey} must be a number`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validateConfigSchema, REQUIRED_TOP_LEVEL_KEYS };
