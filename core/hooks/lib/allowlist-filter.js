const fs = require('node:fs');
const path = require('node:path');

// Reads the allowlist directly from zenno/config.json rather than caching
// it, since the file is small and this keeps the module stateless and
// trivially testable — no risk of operating on a stale in-memory copy
// after the user edits their allowlist.
function readAllowlist(repoRoot) {
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  if (!fs.existsSync(configPath)) {
    return [];
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config?.shield?.secretScanner?.allowlist ?? [];
  } catch {
    return []; // malformed config.json — fail closed to an empty allowlist,
    // never fail open by treating a parse error as "everything is allowed"
  }
}

function filterAllowlisted(findings, allowlist) {
  if (allowlist.length === 0) return findings;
  return findings.filter(
    (finding) => !allowlist.some((allowed) => finding.matchedText.includes(allowed))
  );
}

module.exports = { readAllowlist, filterAllowlisted };
