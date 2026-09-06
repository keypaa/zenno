// Matches lines that look like an assignment/declaration with a quoted
// or bare value at least 16 characters long — long enough that entropy
// is a meaningful signal (short strings don't carry enough information
// for Shannon entropy to distinguish random from ordinary text). Global
// flag so a line with multiple assignments (e.g. "const a = ..., b = ...")
// is fully scanned rather than stopping at the first match.
const ASSIGNMENT_LINE = /(?:[\w.]+)\s*[:=]\s*['"]?([A-Za-z0-9+/_=-]{16,})['"]?/g;

// A common heuristic threshold: fully random base64-like data approaches
// ~6 bits/char; ordinary words and sentences sit well below 4. 4.0 is a
// standard, conservative cutoff used by several existing secret scanners
// for catching random-looking strings without flagging normal prose.
const ENTROPY_THRESHOLD = 4.0;

function shannonEntropy(str) {
  if (str.length === 0) return 0;
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function findHighEntropyStrings(text, threshold = ENTROPY_THRESHOLD) {
  const lines = text.split('\n');
  const findings = [];

  lines.forEach((line, index) => {
    for (const match of line.matchAll(ASSIGNMENT_LINE)) {
      const value = match[1];
      const entropy = shannonEntropy(value);
      if (entropy >= threshold) {
        findings.push({
          value,
          line: index + 1,
          entropy: Math.round(entropy * 100) / 100,
          confidence: 'medium', // entropy alone is a weaker signal than a known pattern
        });
      }
    }
  });

  return findings;
}

module.exports = { findHighEntropyStrings, shannonEntropy, ENTROPY_THRESHOLD };
