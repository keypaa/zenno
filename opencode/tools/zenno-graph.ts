import { tool } from "@opencode-ai/plugin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname4 = path.dirname(fileURLToPath(import.meta.url));
export const zennoGraph = tool({
  description: "Query Zenno's ctags symbol index (zenno/graph/tags) — a fast symbol → file lookup (name → where defined, not a call graph). Use at the start of a task in an existing codebase, before manual grep/glob. If the index is missing it will be generated automatically.",
  args: { query: tool.schema.string().describe("symbol or pattern to search for") },
  async execute(args: any, ctx: any) {
    const dir = ctx?.directory || process.cwd();
    const tagsPath = path.join(dir, "zenno/graph/tags");
    let content: string | null = null;
    if (fs.existsSync(tagsPath)) {
      content = fs.readFileSync(tagsPath, "utf8");
      // Treat an empty or header-only tags file as "not yet built" (same as missing)
      const realLines = content.split("\n").filter((l) => l && !l.startsWith("!_TAG_"));
      if (realLines.length === 0) content = null;
    }
    if (content === null) {
      // Auto-generate so the agent doesn't have to guess the plugin path or
      // run a manual CLI — mirrors Claude's using-the-repo-graph skill flow
      // where the graph is built on demand before the first lookup.
      try {
        const { generateGraph } = require("../../core/hooks/lib/generate-graph.js");
        const { writeGraphMetadata } = require("../../core/hooks/lib/graph-metadata.js");
        const outputDir = path.join(dir, "zenno/graph");
        const result = generateGraph(dir, outputDir);
        if (result.generated) {
          writeGraphMetadata(dir, outputDir);
          content = fs.readFileSync(tagsPath, "utf8");
        }
      } catch (e: any) {
        if (e?.code === "ENOENT") {
          return (
            "Zenno graph: ctags is not installed or not on PATH. Install Universal Ctags to enable repo graph generation (see design spec Section 5). " +
            "Falling back — tell the agent to use grep/glob for this lookup."
          );
        }
        // fall through to no-match handling below
      }
      if (content === null) {
        return "No graph yet — ctags may not have produced output (repo too small or generation failed). Falling back to grep/glob.";
      }
    }
    const lines = content.split("\n").filter((l: string) => l.toLowerCase().includes(args.query.toLowerCase())).slice(0, 20);
    if (lines.length === 0) return `No matches for "${args.query}" in zenno/graph/tags (ctags symbol index — check the spelling, or use grep for free-text search).`;
    const header = `Found ${lines.length} match(es) in zenno/graph/tags (ctags symbol index — name → file, not a call graph):`;
    return header + "\n" + lines.join("\n");
  },
});
