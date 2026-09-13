// Session + idle + tool-after adapters for OpenCode.
// Session.created/updated → bootstrap + memory-read + nudges (non-blocking).
// session.idle / tool.execute.after handle the non-blocking PostToolUse and
// Stop/SubagentStop equivalents (cap near-miss, memory promotion, telemetry).
const path = require("node:path");
const os = require("node:os");

function projectDirOf(ctx) {
  return ctx?.directory || ctx?.worktree || process.cwd();
}

function handleSessionEvent(event, ctx) {
  const type = event?.type;
  const projectDir = projectDirOf(ctx);
  if (type === "session.created" || type === "session.updated") {
    try {
      const { runBootstrap } = require("../../core/hooks/bootstrap.js");
      const { deriveProjectMemoryDir } = require("../../core/hooks/bootstrap-cli.js");
      const homeDir = os.homedir();
      runBootstrap({ targetRepoRoot: projectDir, homeDir, memoryDir: deriveProjectMemoryDir(projectDir, homeDir) });
    } catch {}
    // graph staleness nudge + doctor nudge are informational (stdout/stderr only)
    try {
      const { checkAndNudge } = require("../../core/hooks/lib/graph-staleness-nudge-cli.js");
      const { nudged, staleness } = checkAndNudge(projectDir);
      if (nudged) {
        const detail = staleness.reason === "never-generated" ? "no graph has been generated yet" : `${staleness.commitsBehind} commit(s) behind`;
        process.stderr.write(`Zenno: repo graph is stale (${detail}). Run the graph-generation skill to refresh it.\n`);
      }
    } catch {}
    try {
      const { runNudge } = require("../../core/hooks/lib/doctor-nudge-cli.js");
      const { output } = runNudge(projectDir, projectDir, os.homedir());
      if (output) process.stdout.write(output + "\n");
    } catch {}
  }
  if (type === "session.idle" || type === "session.status") {
    // Cap near-miss + memory promotion — fire-and-forget, never blocks
    try {
      const mod = require("../../core/hooks/lib/cap-near-miss-hook.js");
      if (typeof mod.checkNearMiss === "function") mod.checkNearMiss(projectDir);
    } catch {}
    try {
      const { runCorroborationSweep } = require("../../core/hooks/lib/memory-promotion-sweep-hook.js");
      const { deriveProjectMemoryDir } = require("../../core/hooks/bootstrap-cli.js");
      runCorroborationSweep(deriveProjectMemoryDir(projectDir, os.homedir()));
    } catch {}
  }
}

function handleToolAfter(ctx) {
  const projectDir = projectDirOf(ctx);
  try {
    const { syncJournalToTelemetry } = require("../../core/hooks/lib/journal-telemetry-bridge.js");
    syncJournalToTelemetry(projectDir);
  } catch {}
  try {
    const m = require("../../core/hooks/lib/guard-warning-hook.js");
    if (typeof m.syncGuardWarnings === "function") m.syncGuardWarnings(projectDir);
  } catch {}
  // Agent lifecycle: agent-team start/stop hooks need session lifecycle
  // In OpenCode, subagent depth tracking differs — bootstrap handles it via
  // the agent-team state file in the repo root; PostToolUse is a reasonable
  // approximation to SubagentStop for promotion/cap checks.
}

module.exports = { handleSessionEvent, handleToolAfter };
