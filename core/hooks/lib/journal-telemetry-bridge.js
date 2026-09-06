const fs = require('node:fs');
const path = require('node:path');
const { buildGuardEvent } = require('./span-builder');
const { generateTraceId, generateSpanId } = require('./otel-ids');
const { exportSpan } = require('./otlp-file-exporter');

// Non-invasive bridge: rather than retrofitting each already-shipped
// Shield guard (Plans #3-#6) to emit telemetry directly, this reads
// NEW entries from the existing zenno/audit/journal.jsonl (which
// Provenance Guard and Haruspex Guard already write to) and converts
// them into telemetry span events. A small checkpoint file tracks how
// many journal lines have already been processed, so re-running this
// never re-emits the same entries twice.
function checkpointPath(repoRoot) {
  return path.join(repoRoot, 'zenno', 'telemetry', '.journal-checkpoint.json');
}

function readCheckpoint(repoRoot) {
  const p = checkpointPath(repoRoot);
  if (!fs.existsSync(p)) return { lastProcessedLine: 0 };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { lastProcessedLine: 0 };
  }
}

function writeCheckpoint(repoRoot, checkpoint) {
  const p = checkpointPath(repoRoot);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(checkpoint, null, 2) + '\n', 'utf8');
}

// Journal entry types that represent a guard actually firing (warning or
// block) — "new-dependency" entries that are neither typosquat-suspected
// nor very-recently-published are routine logging, not a guard "firing"
// in the observability sense, so they're excluded here.
function isGuardFiringEntry(entry) {
  if (entry.type === 'self-mod-warning') return true;
  if (entry.type === 'new-dependency' && (entry.typosquatSuspected || entry.veryRecentlyPublished)) return true;
  return false;
}

function syncJournalToTelemetry(repoRoot) {
  const journalPath = path.join(repoRoot, 'zenno', 'audit', 'journal.jsonl');
  if (!fs.existsSync(journalPath)) return { synced: 0 };

  const lines = fs.readFileSync(journalPath, 'utf8').trim().split('\n').filter(Boolean);
  const checkpoint = readCheckpoint(repoRoot);
  const newLines = lines.slice(checkpoint.lastProcessedLine);

  let synced = 0;
  for (const line of newLines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // skip malformed lines rather than aborting the whole sync
    }
    if (!isGuardFiringEntry(entry)) continue;

    const guardName = entry.type === 'self-mod-warning' ? 'haruspex-guard' : 'provenance-guard';
    const result = entry.type === 'self-mod-warning' ? 'warn' : (entry.typosquatSuspected ? 'block' : 'warn');
    const span = buildGuardEvent({
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      guardName,
      result,
      reason: entry.type,
      time: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
    });
    exportSpan(repoRoot, span);
    synced++;
  }

  writeCheckpoint(repoRoot, { lastProcessedLine: lines.length });
  return { synced };
}

module.exports = { syncJournalToTelemetry, isGuardFiringEntry, readCheckpoint, writeCheckpoint };
