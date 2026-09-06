#!/usr/bin/env node
// Plan 13 (Cost Tracker/Failure Journal): the early-warning half of the
// Failure Journal. SessionStop/SubagentStop hook comparing final agent-team
// state against caps; appends ONE `cap-near-miss` journal entry when usage
// crossed the near-miss threshold without tripping the cap. Always exits 0
// — a reporter hook must never block a stop event. Read-only toward caps
// and config; the only writes are the journal line + the dedupe marker.
const fs = require('node:fs');
const path = require('node:path');
const { readAgentTeamState } = require('./agent-team-state');
const { readAgentTeamCaps } = require('./read-agent-team-caps');
const { NEAR_MISS_THRESHOLD } = require('./cost-attribution');
const { appendJournalEntry } = require('./append-journal-entry');

function seenMarkerPath(repoRoot) {
  return path.join(repoRoot, 'zenno', 'audit', '.cap-near-miss-seen.json');
}

function readSeenMarker(repoRoot) {
  const p = seenMarkerPath(repoRoot);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null; // malformed marker is treated as unseen, never a crash
  }
}

function writeSeenMarker(repoRoot, spawned) {
  const p = seenMarkerPath(repoRoot);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ totalSpawned: spawned }) + '\n', 'utf8');
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function checkNearMiss(repoRoot) {
  const state = readAgentTeamState(repoRoot);
  const caps = readAgentTeamCaps(repoRoot);
  const spawned = state.totalSpawned;
  const totalCap = caps.totalPerTaskCap;
  const proximity = totalCap > 0 ? spawned / totalCap : 0;

  // Below threshold: nothing to report. At/above 1.0 the cap already
  // tripped and blocked — that's the cap hook's story, not a near-miss.
  if (proximity < NEAR_MISS_THRESHOLD || proximity >= 1) {
    return { reported: false };
  }

  // Dedupe: one entry per threshold-crossing per task. A further spawn
  // changes totalSpawned, so the next crossing reports again.
  const seen = readSeenMarker(repoRoot);
  if (seen && seen.totalSpawned === spawned) {
    return { reported: false };
  }

  appendJournalEntry(repoRoot, {
    type: 'cap-near-miss',
    spawned,
    totalCap,
    proximity: Math.round(proximity * 100) / 100,
    caps: {
      depthCap: caps.depthCap,
      concurrentCap: caps.concurrentCap,
      totalPerTaskCap: caps.totalPerTaskCap,
    },
  });
  writeSeenMarker(repoRoot, spawned);
  return { reported: true, spawned, totalCap, proximity };
}

function main() {
  const payload = readStdinJson();
  const repoRoot = payload.cwd || process.cwd();
  checkNearMiss(repoRoot);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { checkNearMiss, NEAR_MISS_THRESHOLD };
