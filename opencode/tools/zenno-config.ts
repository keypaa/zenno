export function buildZennoConfigExport(getDir: (sessionID?: string) => Promise<string>) {
  return {
    name: "zenno_config_export",
    description: "Back up zenno/config.json — exporting a copy. Use when you want to share or restore config.",
    input: {
      type: "object",
      properties: { dest: { type: "string", description: "destination path for the exported config" } },
      required: ["dest"],
      additionalProperties: false,
    },
    execute: async (args: any, tctx: any) => {
      const dir = await getDir(tctx?.sessionID);
      const { exportConfig } = require("../../core/hooks/lib/config-export.js");
      return { content: JSON.stringify(exportConfig(dir, args.dest), null, 2) };
    },
  };
}

export function buildZennoConfigImport(getDir: (sessionID?: string) => Promise<string>) {
  return {
    name: "zenno_config_import",
    description:
      "Restore zenno/config.json from a file. Validates schema, diffs, and flags security-weakening changes before applying — use --confirm to apply flagged changes.",
    input: {
      type: "object",
      properties: {
        source: { type: "string", description: "source config file path" },
        confirm: { type: "boolean", description: "confirm security-weakening changes" },
      },
      required: ["source"],
      additionalProperties: false,
    },
    execute: async (args: any, tctx: any) => {
      const dir = await getDir(tctx?.sessionID);
      const { runConfigImport } = require("../../core/hooks/lib/config-import-cli.js");
      return { content: JSON.stringify(runConfigImport(dir, args.source, { confirm: !!args.confirm }), null, 2) };
    },
  };
}
