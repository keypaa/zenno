const fs = require('node:fs');
const path = require('node:path');
const { listSessionFiles } = require('./session-discovery');
const { redactSecrets } = require('./trace-secret-redaction');
const { rawTracesDir } = require('./trace-paths');

// Raw mode: every session transcript, redacted and copied as-is into
// zenno/traces/raw/ — matching the reference tool's own full-session-dump
// behavior. The mandatory secret-scan pass (via redactSecrets) runs on
// every file before anything is written to disk, no exceptions.
function exportRawTraces(repoRoot, sessionsDir) {
  const sessionFiles = listSessionFiles(sessionsDir);
  if (sessionFiles.length === 0) {
    return { exported: 0, files: [], totalRedactions: 0 };
  }

  const outputDir = rawTracesDir(repoRoot);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const exportedFiles = [];
  let totalRedactions = 0;

  for (const sessionFile of sessionFiles) {
    const content = fs.readFileSync(sessionFile, 'utf8');
    const { redactedText, redactedCount } = redactSecrets(content);
    totalRedactions += redactedCount;

    const outputPath = path.join(outputDir, path.basename(sessionFile));
    fs.writeFileSync(outputPath, redactedText, 'utf8');
    exportedFiles.push(outputPath);
  }

  return { exported: exportedFiles.length, files: exportedFiles, totalRedactions };
}

module.exports = { exportRawTraces };
