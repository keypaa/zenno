import { tool } from "@opencode-ai/plugin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname4 = path.dirname(fileURLToPath(import.meta.url));
export const zennoGraph = tool({
  description: "Query the ctags symbol index (zenno/graph/tags). Use at the start of a task in an existing codebase, before manual exploration.",
  args: { query: tool.schema.string().describe("symbol or pattern to search for") },
  async execute(args: any, ctx: any) {
    const dir = ctx?.directory || process.cwd();
    const tagsPath = path.join(dir, "zenno/graph/tags");
    if (!fs.existsSync(tagsPath)) return "No graph yet — run: node <plugin-root>/core/hooks/lib/generate-graph-cli.js";
    const content = fs.readFileSync(tagsPath, "utf8");
    const lines = content.split("\n").filter((l: string) => l.toLowerCase().includes(args.query.toLowerCase())).slice(0, 20);
    return lines.length ? lines.join("\n") : `No matches for "${args.query}"`;
  },
});
