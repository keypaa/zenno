const fs = require('node:fs');
const path = require('node:path');

// Minimal, deliberately narrow: appends one typed JSON line to
// zenno/audit/journal.jsonl, creating the directory/file if needed. This
// is NOT the full Cost Tracker/Failure Journal system from design spec
// Section 12.4 (Plan #13) — that plan will build cost attribution and
// richer typed-entry conventions on top of this same file. This module
// exists now because Provenance Guard needs to log "any new dependency"
// unconditionally (Section 6.3), and that requirement can't wait for
// Plan #13 to exist. Plan #13 should treat this function as a shared
// primitive to build on, not something to replace.
function appendJournalEntry(repoRoot, entry) {
  const auditDir = path.join(repoRoot, 'zenno', 'audit');
  const journalPath = path.join(auditDir, 'journal.jsonl');

  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  fs.appendFileSync(journalPath, line + '\n', 'utf8');
  return { path: journalPath };
}

module.exports = { appendJournalEntry };
