/**
 * Zenno for OpenCode — thin adapter overlay on shared core/
 *
 * 100% feature parity with the Claude Code plugin (same core/, same
 * 432 tests). This file is the plugin entrypoint only; permission logic
 * lives in opencode/hooks/permission.js so plugin.ts and tests share one
 * implementation.
 *
 * Discovery pin: /home/keypaa/.local/share/mise/installs/opencode/latest/opencode (1.18.30)
 */
import { handlePermissionAsk } from "./hooks/permission.js";
import { handleSessionEvent, handleToolAfter } from "./hooks/session.js";
import { zennoDoctor } from "./tools/zenno-doctor.js";
import { zennoCostReport } from "./tools/zenno-cost-report.js";
import { zennoMemory } from "./tools/zenno-memory.js";
import { zennoGraph } from "./tools/zenno-graph.js";
import { zennoTraceExport } from "./tools/zenno-trace-export.js";
import { zennoConfigExport, zennoConfigImport } from "./tools/zenno-config.js";
import { zennoBoundedResearch, zennoPlanStressTest } from "./tools/zenno-research.js";

export const server = async (input: any) => {
  const projectDir = input?.directory || input?.worktree || process.cwd();

  return {
    "permission.ask": async (perm: any, output: any) => {
      await handlePermissionAsk(perm, output, { projectDir, pluginRoot: input?.directory || projectDir });
    },
    event: async ({ event }: any) => {
      handleSessionEvent(event, { directory: projectDir, worktree: projectDir });
    },
    "tool.execute.after": async (ctx: any, out: any) => {
      handleToolAfter({ directory: projectDir });
    },
    tool: {
      zenno_doctor: zennoDoctor,
      zenno_cost_report: zennoCostReport,
      zenno_memory: zennoMemory,
      zenno_graph: zennoGraph,
      zenno_trace_export: zennoTraceExport,
      zenno_config_export: zennoConfigExport,
      zenno_config_import: zennoConfigImport,
      zenno_bounded_research: zennoBoundedResearch,
      zenno_plan_stress_test: zennoPlanStressTest,
    },
  };
};
export default server;
