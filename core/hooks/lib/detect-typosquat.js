// Small, curated list of high-value, commonly-squatted package names
// across the three supported ecosystems. Deliberately not exhaustive —
// this is the "local list" half of the design spec's "local list +
// edit-distance" combination; the registry lookup (a separate module)
// adds a live signal on top for packages not on this list at all.
const HIGH_VALUE_PACKAGES = {
  npm: ['express', 'react', 'lodash', 'axios', 'chalk', 'commander', 'webpack', 'eslint', 'jest', 'typescript'],
  pip: ['requests', 'flask', 'django', 'numpy', 'pandas', 'boto3', 'pytest', 'urllib3', 'pyyaml', 'setuptools'],
  cargo: ['serde', 'tokio', 'clap', 'reqwest', 'rand', 'regex', 'log', 'anyhow', 'thiserror', 'chrono'],
};

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

// A close-but-not-exact match to a known high-value package is the
// typosquat signal — an EXACT match is not a typosquat, it's just the
// real package. The allowed distance scales with name length rather than
// a single fixed cutoff: short names (<=4 chars) only flag on a
// single-character difference (distance 1), since a distance-2 window on
// a very short word covers too much ground and risks false positives;
// longer names allow distance <=2, catching realistic typos ("expres",
// "expresss", "expres5") without over-triggering.
function detectTyposquat(packageName, ecosystem) {
  const knownPackages = HIGH_VALUE_PACKAGES[ecosystem] || [];

  for (const known of knownPackages) {
    if (packageName === known) continue; // exact match is the real package, not a typosquat
    const distance = levenshteinDistance(packageName, known);
    const allowedDistance = known.length <= 4 ? 1 : 2;
    if (distance > 0 && distance <= allowedDistance) {
      return { isTyposquat: true, suspectedRealPackage: known, distance };
    }
  }

  return { isTyposquat: false, suspectedRealPackage: null, distance: null };
}

module.exports = { detectTyposquat, levenshteinDistance, HIGH_VALUE_PACKAGES };
