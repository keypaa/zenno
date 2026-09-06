const { matchesAnyPattern } = require('./glob-pattern-matcher');

// Allow patterns are checked first and always win over deny patterns —
// this is what lets ".env.example" stay readable even though ".env.*"
// would otherwise match it. A file that matches neither list is allowed
// by default; this guard is a denylist, not an allowlist-only gate.
function shouldBlockPath(filePath, config) {
  if (matchesAnyPattern(filePath, config.allowPatterns)) {
    return false;
  }
  return matchesAnyPattern(filePath, config.denyPatterns);
}

module.exports = { shouldBlockPath };
