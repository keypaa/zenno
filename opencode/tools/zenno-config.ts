import { tool } from "@opencode-ai/plugin";
export const zennoConfigExport = tool({
  description: "Back up zenno/config.json — exporting a copy. Use when you want to share or restore config.",
  args: { dest: tool.schema.string().describe("destination path for the exported config") },
  async execute(args: any, ctx: any) {
    const dir = ctx?.directory || process.cwd();
    const { exportConfig } = require("../../core/hooks/lib/config-export.js");
    return JSON.stringify(exportConfig(dir, args.dest), null, 2);
  },
});
export const zennoConfigImport = tool({
  description: "Restore zenno/config.json from a file. Validates schema, diffs, and flags security-weakening changes before applying — use --confirm to apply flagged changes.",
  args: { source: tool.schema.string().describe("source config file path"), confirm: tool.schema.boolean().optional().describe("confirm security-weakening changes") },
  async execute(args: any, ctx: any) {
    const dir = ctx?.directory || process.cwd();
    const { runConfigImport } = require("../../core/hooks/lib/config-import-cli.js");
    return JSON.stringify(runConfigImport(dir, args.source, { confirm: !!args.confirm }), null, 2);
  },
});
