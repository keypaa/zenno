import { tool } from "@opencode-ai/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "../..");
export const zennoDoctor = tool({
  description: "Run zenno doctor health checks (30+ checks including live guard sanity runs). Use when Zenno reports a problem or to verify installation health.",
  args: {},
  async execute(_args: any, ctx: any) {
    const { runDoctor } = require("../../core/hooks/lib/doctor-cli.js");
    const dir = ctx?.directory || process.cwd();
    const { output, exitCode } = runDoctor(PLUGIN_ROOT, dir);
    return exitCode === 0 ? output : `doctor found issues (exit ${exitCode}):\n${output}`;
  },
});
