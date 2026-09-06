const fs = require('node:fs');
const path = require('node:path');

// These match Foundation's write-config.js defaultConfig() exactly — kept
// as a local copy rather than importing from Foundation's module, since
// this guard must keep working even if config.json is missing or
// malformed and Foundation's own module isn't guaranteed to be reachable
// in every execution context this hook might run in.
const DEFAULT_DENY_PATTERNS = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  'id_rsa',
  'id_ed25519',
  'credentials.json',
  'secrets.yml',
  'secrets.yaml',
  '.npmrc',
  '.netrc',
];
const DEFAULT_ALLOW_PATTERNS = ['.env.example', '.env.sample', '.env.template'];

function readGuardConfig(repoRoot) {
  const configPath = path.join(repoRoot, 'zenno', 'config.json');

  if (!fs.existsSync(configPath)) {
    return { denyPatterns: DEFAULT_DENY_PATTERNS, allowPatterns: DEFAULT_ALLOW_PATTERNS };
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const guard = config?.shield?.confidentialFileGuard;
    return {
      // This is a PROTECTIVE deny list, unlike Secret Scanner's allowlist —
      // failing "safe" here means falling back to the hardcoded defaults,
      // not an empty list. An empty deny list on a malformed config would
      // silently disable the guard entirely; the built-in defaults never do.
      denyPatterns: guard?.denyPatterns ?? DEFAULT_DENY_PATTERNS,
      allowPatterns: guard?.allowPatterns ?? DEFAULT_ALLOW_PATTERNS,
    };
  } catch {
    // Malformed config.json — fall back to defaults rather than disabling
    // protection. This is the opposite fail-safe direction from Secret
    // Scanner's allowlist reader (which fails to an empty allowlist);
    // here, "safe" means "still protected," not "least restrictive."
    return { denyPatterns: DEFAULT_DENY_PATTERNS, allowPatterns: DEFAULT_ALLOW_PATTERNS };
  }
}

module.exports = { readGuardConfig, DEFAULT_DENY_PATTERNS, DEFAULT_ALLOW_PATTERNS };
