const { findPatternMatches } = require('./detect-secret-patterns');
const { findHighEntropyStrings } = require('./entropy-scanner');
const { readAllowlist, filterAllowlisted } = require('./allowlist-filter');

function scanForSecrets(text, repoRoot) {
  const patternFindings = findPatternMatches(text).map((f) => ({
    type: f.type,
    matchedText: f.match,
    line: f.line,
    confidence: f.confidence,
  }));

  const entropyFindings = findHighEntropyStrings(text).map((f) => ({
    type: 'high-entropy-string',
    matchedText: f.value,
    line: f.line,
    confidence: f.confidence,
  }));

  const allFindings = [...patternFindings, ...entropyFindings];
  const allowlist = readAllowlist(repoRoot);
  const findings = filterAllowlisted(allFindings, allowlist);

  return {
    hasHighConfidenceMatch: findings.some((f) => f.confidence === 'high'),
    findings,
  };
}

module.exports = { scanForSecrets };
