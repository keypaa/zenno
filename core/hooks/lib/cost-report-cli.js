#!/usr/bin/env node
// Plan 13 (Cost Tracker/Failure Journal): `zenno cost report` — a thin,
// Zenno-specific attribution layer over the existing session JSONL data
// (design §12.4). No new API-call instrumentation, no dollar conversion,
// no network calls. Human report by default, raw JSON with --json. Every
// successful run appends a `cost-report` journal entry so reports are
// auditable, not silent.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readSessionUsage } = require('./session-usage-reader');
const { attributeCosts, summarizeAttribution } = require('./cost-attribution');
const { readAgentTeamState } = require('./agent-team-state');
const { readAgentTeamCaps } = require('./read-agent-team-caps');
const { isGuardFiringEntry } = require('./journal-telemetry-bridge');
const { appendJournalEntry } = require('./append-journal-entry');

// Same deriveMemoryDir contract as doctor-cli.js (re-derived locally, not
// imported — doctor-cli.js is a CLI entrypoint, not a library).
function deriveProjectDir(repoRoot, homeDir) {
  const slug = repoRoot
    .replace(/^[A-Za-z]:/, '')
    .split(/[\\/]/)
    .filter(Boolean)
    .join('-');
  return path.join(homeDir, '.claude', 'projects', `-${slug}`);
}

function listSessionFiles(projectDir) {
  if (!fs.existsSync(projectDir)) return [];
  return fs
    .readdirSync(projectDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(projectDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

// GuardName/result mapping is journal-telemetry-bridge.js lines 63-64
// verbatim (that table is not exported from the bridge; importing the
// classifier and re-stating the two-line table keeps the shipped module's
// public surface unchanged).
function firingToAttribution(entry) {
  if (entry.type === 'self-mod-warning') {
    return { guardName: 'haruspex-guard', result: 'warn' };
  }
  const result = entry.typosquatSuspected ? 'block' : 'warn';
  return { guardName: 'provenance-guard', result };
}

function readGuardFirings(repoRoot) {
  const journalPath = path.join(repoRoot, 'zenno', 'audit', 'journal.jsonl');
  if (!fs.existsSync(journalPath)) return [];
  const firings = [];
  for (const line of fs.readFileSync(journalPath, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // per-line garbage is skipped, same as the reader
    }
    if (isGuardFiringEntry(entry)) {
      firings.push(firingToAttribution(entry));
    }
  }
  return firings;
}

function formatHumanReport(report, sessionCount) {
  const lines = [summarizeAttribution(report)];
  lines.push('');
  lines.push(`sessions analyzed: ${sessionCount}`);
  lines.push('tokens by model:');
  for (const [model, u] of Object.entries(report.byModel)) {
    lines.push(`  ${model}: ${u.messages} messages, ${u.inputTokens.toLocaleString('en-US')} in / ${u.outputTokens.toLocaleString('en-US')} out`);
  }
  const guardNames = Object.keys(report.guards.byGuard);
  if (guardNames.length > 0) {
    lines.push('guard activity:');
    for (const name of guardNames) {
      const g = report.guards.byGuard[name];
      lines.push(`  ${name}: ${g.block} block, ${g.warn} warn`);
    }
  } else {
    lines.push('guard activity: none');
  }
  return lines.join('\n');
}

function runCostReport(repoRoot, homeDir, options = {}) {
  const projectDir = deriveProjectDir(repoRoot, homeDir);
  let files = listSessionFiles(projectDir);
  if (options.session) {
    files = files.filter((f) => path.basename(f, '.jsonl') === options.session);
  }
  if (files.length === 0) {
    return { ok: false, error: 'no session transcripts found for this repo' };
  }

  const rows = [];
  for (const f of files) {
    let parsed;
    try {
      parsed = readSessionUsage(f);
    } catch (e) {
      return { ok: false, error: `unparseable session file ${path.basename(f)}: ${e.message}` };
    }
    rows.push(...parsed.rows);
  }

  const agentState = readAgentTeamState(repoRoot);
  const caps = readAgentTeamCaps(repoRoot);
  const guardFirings = readGuardFirings(repoRoot);
  const report = attributeCosts({ rows, agentState, caps, guardFirings });

  const journalResult = appendJournalEntry(repoRoot, {
    type: 'cost-report',
    sessions: files.map((f) => path.basename(f, '.jsonl')),
    totals: report.totals,
    agentTeamProximity: report.agentTeam.proximity,
    guardFirings: report.guards.firings,
  });

  return { ok: true, report, sessionCount: files.length, journalPath: journalResult.path };
}

function main() {
  const args = process.argv.slice(2);
  const sessionIdx = args.indexOf('--session');
  const session = sessionIdx >= 0 ? args[sessionIdx + 1] : undefined;
  const asJson = args.includes('--json');
  const repoRoot = process.cwd();
  const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();

  const result = runCostReport(repoRoot, homeDir, { session });
  if (!result.ok) {
    process.stderr.write(`Zenno cost report: ${result.error}\n`);
    process.exit(1);
  }
  if (asJson) {
    process.stdout.write(JSON.stringify(result.report, null, 2) + '\n');
  } else {
    process.stdout.write(formatHumanReport(result.report, result.sessionCount) + '\n');
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { runCostReport, formatHumanReport, deriveProjectDir, readGuardFirings };
