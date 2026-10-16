import os from "node:os";

export function buildZennoCostReport(getDir: (sessionID?: string) => Promise<string>) {
  return {
    name: "zenno_cost_report",
    description:
      "Token attribution per session (tokens by model, cap proximity, guard activity). Reads the repo session transcripts, not dollars.",
    input: {
      type: "object",
      properties: { session: { type: "string", description: "session id to filter" } },
      additionalProperties: false,
    },
    execute: async (args: any, tctx: any) => {
      const { runCostReport } = require("../../core/hooks/lib/cost-report-cli.js");
      const dir = await getDir(tctx?.sessionID);
      const result = runCostReport(dir, os.homedir(), { session: args.session });
      if (!result.ok) return { content: `no report: ${result.error}` };
      const { summarizeAttribution } = require("../../core/hooks/lib/cost-attribution.js");
      return { content: summarizeAttribution(result.report) };
    },
  };
}
