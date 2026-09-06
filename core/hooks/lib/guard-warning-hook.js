#!/usr/bin/env node
// Plan 13 (Cost Tracker/Failure Journal): the journal half of the Failure
// Journal for guard activity (the telemetry half already exists as
// journal-telemetry-bridge.js). PostToolUse hook reading the journal's NEW
// lines since its own checkpoint and appending one `guard-warning` entry
// per guard firing. Always exits 0 — a reporter hook must never block.
const fs = require('node:fs');
const path = require('node:path');
const { isGuardFiringEntry } = require('./journal-telemetry-bridge');
const { appendJournalEntry } = require('./append-journal-entry');

function checkpointPath(repoRoot) {
  return path.join(repoRoot, 'zenno', 'audit', '.guard-warning-checkpoint.json');
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

// GuardName/result mapping is journal-telemetry-bridge.js lines 63-64
// verbatim (that table is not exported from the bridge; re-stating the
// two-line table keeps the shipped module's public surface unchanged).
function firingToWarning(entry) {
  if (entry.type === 'self-mod-warning') {
    return { guardName: 'haruspex-guard', result: 'warn' };
  }
  const result = entry.typosquatSuspected ? 'block' : 'warn';
  return { guardName: 'provenance-guard', result };
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function syncGuardWarnings(repoRoot) {
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
    const { guardName, result } = firingToWarning(entry);
    appendJournalEntry(repoRoot, {
      type: 'guard-warning',
      guardName,
      result,
      reason: entry.type,
      at: entry.timestamp,
    });
    synced++;
  }

  writeCheckpoint(repoRoot, { lastProcessedLine: lines.length });
  return { synced };
}

function main() {
  const payload = readStdinJson();
  const repoRoot = payload.cwd || process.cwd();
  syncGuardWarnings(repoRoot);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { syncGuardWarnings };
