import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "../..");

export function buildZennoDoctor(getDir: (sessionID?: string) => Promise<string>) {
  return {
    name: "zenno_doctor",
    description:
      "Run zenno doctor health checks (30+ checks including live guard sanity runs). Use when Zenno reports a problem or to verify installation health.",
    input: { type: "object", properties: {}, additionalProperties: false },
    execute: async (_args: any, tctx: any) => {
      const { runDoctor } = require("../../core/hooks/lib/doctor-cli.js");
      const dir = await getDir(tctx?.sessionID);
      const { output, exitCode } = runDoctor(PLUGIN_ROOT, dir);
      return { content: exitCode === 0 ? output : `doctor found issues (exit ${exitCode}):\n${output}` };
    },
  };
}
