const fs = require('node:fs');
const path = require('node:path');

function telemetryFilePath(repoRoot, date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10);
  return path.join(repoRoot, 'zenno', 'telemetry', `spans-${dateStr}.jsonl`);
}

function exportSpan(repoRoot, span) {
  const filePath = telemetryFilePath(repoRoot);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(span) + '\n', 'utf8');
}

module.exports = { exportSpan, telemetryFilePath };
