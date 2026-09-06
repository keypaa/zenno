// Known, high-confidence secret shapes. Each pattern is specific enough
// that a match is very unlikely to be anything else — these are the
// patterns that justify a hard block with no soft-warn tier, per the
// design spec's "no soft-warn tier at this gate" requirement for the
// commit/push checkpoint.
const PATTERNS = [
  { type: 'aws-access-key-id', regex: /AKIA[0-9A-Z]{16}/g },
  { type: 'github-pat', regex: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { type: 'github-fine-grained-pat', regex: /github_pat_[A-Za-z0-9_]{22,}/g },
  {
    type: 'private-key-block',
    regex: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  { type: 'slack-token', regex: /xox[baprs]-[0-9A-Za-z-]{10,48}/g },
  { type: 'stripe-live-key', regex: /sk_live_[0-9a-zA-Z]{20,}/g },
];

function findPatternMatches(text) {
  const lines = text.split('\n');
  const findings = [];

  lines.forEach((line, index) => {
    for (const { type, regex } of PATTERNS) {
      regex.lastIndex = 0; // regexes are reused across lines, reset state
      let match;
      while ((match = regex.exec(line)) !== null) {
        findings.push({
          type,
          match: match[0],
          line: index + 1,
          confidence: 'high',
        });
      }
    }
  });

  return findings;
}

module.exports = { findPatternMatches, PATTERNS };
