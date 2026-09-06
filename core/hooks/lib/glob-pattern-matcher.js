const path = require('node:path');

// Minimal glob support: only "*" as a wildcard (matches any sequence of
// characters, including none). No "?", no "**", no character classes —
// deliberately narrow scope, since the deny/allow patterns this guards
// (.env, .env.*, *.pem, id_rsa, credentials.json, etc.) never need more
// than that. Matching is against the basename only, not the full path,
// so a pattern like "id_rsa" or "*.pem" catches the file regardless of
// which directory it lives in — the same convention .gitignore uses for
// patterns with no slash.
function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${withWildcards}$`);
}

function matchesAnyPattern(filePath, patterns) {
  const basename = path.basename(filePath);
  return patterns.some((pattern) => globToRegExp(pattern).test(basename));
}

module.exports = { matchesAnyPattern, globToRegExp };
