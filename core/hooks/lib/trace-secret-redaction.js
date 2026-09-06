const { findPatternMatches } = require('./detect-secret-patterns');
const { findHighEntropyStrings, shannonEntropy } = require('./entropy-scanner');

const REDACTION_PLACEHOLDER = '[ZENNO-REDACTED-SECRET]';

// JSON-string-value-aware entropy check: matches "key":"value" (quoted
// keys, colon, quoted value) — the raw JSON shape session transcripts are
// actually in. entropy-scanner.js's own ASSIGNMENT_LINE pattern (built
// for JS-source-style "key = value" / "key: value" in Plan #3's git-diff
// scanning context) doesn't match this, since it doesn't expect a quote
// immediately before the key. Rather than modify that already-shipped,
// already-tested module for a use case it wasn't built for, this adds a
// second, JSON-specific pattern here, reusing the underlying
// shannonEntropy utility (a generic, reusable function, not JS-specific).
const JSON_STRING_VALUE = /"[\w.]+"\s*:\s*"([A-Za-z0-9+/_=-]{16,})"/g;

function findJsonEntropyValues(text) {
  const values = [];
  let match;
  JSON_STRING_VALUE.lastIndex = 0;
  while ((match = JSON_STRING_VALUE.exec(text)) !== null) {
    const value = match[1];
    if (shannonEntropy(value) >= 4.0) values.push(value);
  }
  return values;
}

// Reuses Secret Scanner's own detection logic (Plan #3) rather than
// duplicating it — both pattern-based (high confidence) and
// entropy-based (medium confidence) findings are redacted here, a wider
// net than the Secret Scanner guard itself uses. That guard only hard-
// blocks on high-confidence matches specifically to avoid over-blocking
// legitimate commits; a training-data export has different risk
// tolerance — over-redacting costs a little data richness, under-
// redacting risks a real secret landing in an exported dataset. Both
// tiers are redacted here.
function redactSecrets(text) {
  const patternMatches = findPatternMatches(text);
  const entropyMatches = findHighEntropyStrings(text);

  const valuesToRedact = new Set([
    ...patternMatches.map((f) => f.match),
    ...entropyMatches.map((f) => f.value),
    ...findJsonEntropyValues(text),
  ]);

  let redactedText = text;
  for (const value of valuesToRedact) {
    if (!value) continue;
    redactedText = redactedText.split(value).join(REDACTION_PLACEHOLDER);
  }

  return { redactedText, redactedCount: valuesToRedact.size };
}

module.exports = { redactSecrets, REDACTION_PLACEHOLDER };
