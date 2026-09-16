import { tool } from "@opencode-ai/plugin";
export const zennoTraceExport = tool({
  description: "Export session history for fine-tuning/dataset creation. Wraps session transcripts with mandatory secret redaction.",
  args: { mode: tool.schema.enum(["raw"]).optional().describe("export mode (only raw is implemented)") },
  async execute(args: any, ctx: any) {
    if (args.mode && args.mode !== "raw") return "Only --mode=raw is implemented (curated depends on task-tracking mechanics not yet in Zenno).";
    const dir = ctx?.directory || process.cwd();
    return `Run: node <plugin-root>/core/hooks/lib/export-traces-cli.js --mode=raw (from repo root ${dir})`;
  },
});
