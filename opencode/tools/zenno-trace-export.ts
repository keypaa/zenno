export function buildZennoTraceExport(getDir: (sessionID?: string) => Promise<string>) {
  return {
    name: "zenno_trace_export",
    description:
      "Export session history for fine-tuning/dataset creation. Wraps session transcripts with mandatory secret redaction.",
    input: {
      type: "object",
      properties: { mode: { type: "string", enum: ["raw"], description: "export mode (only raw is implemented)" } },
      additionalProperties: false,
    },
    execute: async (args: any, tctx: any) => {
      if (args.mode && args.mode !== "raw")
        return { content: "Only --mode=raw is implemented (curated depends on task-tracking mechanics not yet in Zenno)." };
      const dir = await getDir(tctx?.sessionID);
      return { content: `Run: node <plugin-root>/core/hooks/lib/export-traces-cli.js --mode=raw (from repo root ${dir})` };
    },
  };
}
