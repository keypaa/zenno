import { tool } from "@opencode-ai/plugin";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT2 = path.resolve(__dirname2, "../..");
export const zennoCostReport = tool({
  description: "Token attribution per session (tokens by model, cap proximity, guard activity). Reads the repo session transcripts, not dollars.",
  args: { session: tool.schema.string().optional().describe("session id to filter") },
  async execute(args: any, ctx: any) {
    const { runCostReport } = require("../../core/hooks/lib/cost-report-cli.js");
    const dir = ctx?.directory || process.cwd();
    const result = runCostReport(dir, os.homedir(), { session: args.session });
    if (!result.ok) return `no report: ${result.error}`;
    const { summarizeAttribution } = require("../../core/hooks/lib/cost-attribution.js");
    return summarizeAttribution(result.report);
  },
});
