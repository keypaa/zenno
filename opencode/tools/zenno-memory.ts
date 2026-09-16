import { tool } from "@opencode-ai/plugin";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname3 = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT3 = path.resolve(__dirname3, "../..");
export const zennoMemory = tool({
  description: "Read or write Zenno project memory (episodic/semantic). Use to recall project facts or leave notes for future sessions.",
  args: {
    action: tool.schema.enum(["read", "write"]).describe("read or write"),
    text: tool.schema.string().optional().describe("text to remember (for write)"),
    kind: tool.schema.enum(["episodic", "semantic"]).optional().describe("memory kind"),
  },
  async execute(args: any, ctx: any) {
    const dir = ctx?.directory || process.cwd();
    if (args.action === "read") {
      const { readSemanticFacts } = require("../../core/hooks/lib/semantic-memory.js");
      const { readRecentEpisodic } = require("../../core/hooks/lib/episodic-memory.js");
      const { deriveProjectMemoryDir } = require("../../core/hooks/bootstrap-cli.js");
      const memDir = deriveProjectMemoryDir(dir, os.homedir());
      return JSON.stringify({ facts: readSemanticFacts(memDir).slice(0, 5), episodic: readRecentEpisodic(memDir, 5) }, null, 2);
    }
    return `Use: echo '{"cwd":"\${dir}"}' | node \${PLUGIN_ROOT3}/core/hooks/lib/memory-remember-cli.js --\${args.kind || "episodic"} "\${args.text || ""}"`;
  },
});
