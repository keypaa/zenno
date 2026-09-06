#!/usr/bin/env node
const os = require('node:os');
const { deriveProjectSessionsDir } = require('./trace-paths');
const { exportRawTraces } = require('./raw-trace-exporter');
const { readTraceMode } = require('./trace-mode-config');

// Curated mode segments exports at Zenno's own task boundaries (subagent
// task->result, Agent Team task completion, Plan Stress-Test verdict)
// instead of raw full-session dumps. The design spec explicitly deferred
// full detail of this mode pending Lifecycle-Ops task-tracking mechanics
// that don't exist yet. Rather than ship a half-built version under the
// "curated" label, this CLI refuses the mode explicitly, with a clear
// message, until it's properly designed.
function resolveMode(explicitMode, repoRoot) {
  return explicitMode || readTraceMode(repoRoot);
}

function runExport(repoRoot, homeDir, mode) {
  if (mode === 'curated') {
    return { success: false, reason: 'curated-mode-not-implemented' };
  }
  if (mode !== 'raw') {
    return { success: false, reason: 'unknown-mode' };
  }
  const sessionsDir = deriveProjectSessionsDir(repoRoot, homeDir);
  const result = exportRawTraces(repoRoot, sessionsDir);
  return { success: true, ...result };
}

function main() {
  const args = process.argv.slice(2);
  const modeFlag = args.find((a) => a.startsWith('--mode='));
  const repoRoot = process.cwd();
  const explicitMode = modeFlag ? modeFlag.split('=')[1] : null;
  const mode = resolveMode(explicitMode, repoRoot);
  const homeDir = os.homedir();

  const result = runExport(repoRoot, homeDir, mode);

  if (!result.success) {
    if (result.reason === 'curated-mode-not-implemented') {
      process.stderr.write(
        'Zenno: curated trace export mode is not yet implemented — it depends ' +
          'on Lifecycle-Ops task-tracking mechanics not yet built (see design ' +
          'spec Section 10/15). Use raw mode instead: --mode=raw\n'
      );
    } else {
      process.stderr.write(`Zenno: unknown trace export mode "${mode}". Valid modes: raw.\n`);
    }
    process.exit(1);
  }

  if (result.exported === 0) {
    process.stdout.write('Zenno: no session transcripts found to export.\n');
    process.exit(0);
  }

  process.stdout.write(
    `Zenno: exported ${result.exported} session transcript(s) to zenno/traces/raw/ ` +
      `(${result.totalRedactions} secret(s) redacted).\n`
  );
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { resolveMode, runExport };
