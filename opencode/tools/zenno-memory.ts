import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname3 = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT3 = path.resolve(__dirname3, "../..");

export function buildZennoMemory(getDir: (sessionID?: string) => Promise<string>) {
  return {
    name: "zenno_memory",
    description:
      "Read or write Zenno project memory (episodic/semantic). Use to recall project facts or leave notes for future sessions.",
    input: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "write"], description: "read or write" },
        text: { type: "string", description: "text to remember (for write)" },
        kind: { type: "string", enum: ["episodic", "semantic"], description: "memory kind" },
      },
      required: ["action"],
      additionalProperties: false,
    },
    execute: async (args: any, tctx: any) => {
      const dir = await getDir(tctx?.sessionID);
      if (args.action === "read") {
        const { readSemanticFacts } = require("../../core/hooks/lib/semantic-memory.js");
        const { readRecentEpisodic } = require("../../core/hooks/lib/episodic-memory.js");
        const { deriveProjectMemoryDir } = require("../../core/hooks/bootstrap-cli.js");
        const memDir = deriveProjectMemoryDir(dir, os.homedir());
        return {
          content: JSON.stringify(
            { facts: readSemanticFacts(memDir).slice(0, 5), episodic: readRecentEpisodic(memDir, 5) },
            null,
            2,
          ),
        };
      }
      return {
        content: `Use: echo '{"cwd":"${dir}"}' | node ${PLUGIN_ROOT3}/core/hooks/lib/memory-remember-cli.js --${args.kind || "episodic"} "${args.text || ""}"`,
      };
    },
  };
}
