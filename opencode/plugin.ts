/**
 * Zenno for OpenCode — thin adapter overlay on shared core/
 *
 * 100% feature parity with the Claude Code plugin (same core/, same
 * 432 tests). This file is the plugin entrypoint only; permission logic
 * lives in opencode/hooks/permission.js so plugin.ts and tests share one
 * implementation.
 *
 * Dual entrypoint (docs: "Support V1 and V2 from one package"):
 * - V2 (opencode >= 2.x): default export's `id` + `setup()` are used.
 * - V1 (opencode 1.18.29+): `server()` is used, `setup` ignored.
 */
import { Plugin } from "@opencode/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handlePermissionAsk } from "./hooks/permission.js";
import { handleSessionEvent, handleToolAfter } from "./hooks/session.js";
import { evaluateToPerm, applyGuardOutput } from "./v2-adapter.js";
import { buildZennoDoctor } from "./tools/zenno-doctor.js";
import { buildZennoCostReport } from "./tools/zenno-cost-report.js";
import { buildZennoMemory } from "./tools/zenno-memory.js";
import { buildZennoGraph } from "./tools/zenno-graph.js";
import { buildZennoTraceExport } from "./tools/zenno-trace-export.js";
import { buildZennoConfigExport, buildZennoConfigImport } from "./tools/zenno-config.js";
import { buildZennoBoundedResearch, buildZennoPlanStressTest } from "./tools/zenno-research.js";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const server = async (input: any) => {
  const projectDir = input?.directory || input?.worktree || process.cwd();

  return {
    "permission.ask": async (perm: any, output: any) => {
      await handlePermissionAsk(perm, output, { projectDir, pluginRoot: input?.directory || projectDir });
    },
    event: async ({ event }: any) => {
      handleSessionEvent(event, { directory: projectDir, worktree: projectDir });
    },
    "tool.execute.after": async (ctx: any, out: any) => {
      handleToolAfter({ directory: projectDir });
    },
    // NOTE: V1 tool registrations need the legacy @opencode-ai/plugin helper
    // and are intentionally omitted — the 9 tools register via V2 setup().
    // Guards (permission.ask) and lifecycle (event, tool.execute.after)
    // keep working on 1.18.29+ through this function.
  };
};

export default {
  ...Plugin.define({
    id: "zenno",
    async setup(ctx: any) {
      const fallbackDir = () => ctx?.location?.directory || process.cwd();
      const dirOfSession = async (sessionID?: string) => {
        try {
          if (sessionID) {
            const s = await ctx.session.get({ sessionID });
            if (s?.location?.directory) return s.location.directory as string;
          }
        } catch {}
        return fallbackDir();
      };

      // Guards: V1 permission.ask -> V2 permission.evaluate.
      // Only DENY overrides; allow/ask decisions are left untouched.
      await ctx.permission.hook("evaluate", async (event: any) => {
        try {
          const perm = evaluateToPerm(event);
          const output: any = {};
          await handlePermissionAsk(perm, output, {
            projectDir: event?.metadata?.cwd || fallbackDir(),
            pluginRoot: PLUGIN_ROOT,
          });
          applyGuardOutput(event, output);
        } catch {}
      });

      // Session lifecycle: V1 session.created/updated -> V2 session.created event + prompt hook.
      const controller = new AbortController();
      void (async () => {
        try {
          for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
            if (event?.type === "session.created") {
              try {
                const dir =
                  event?.data?.location?.directory || event?.location?.directory || fallbackDir();
                handleSessionEvent({ type: "session.created" }, { directory: dir, worktree: dir });
              } catch {}
            }
          }
        } catch {}
      })();

      await ctx.session.hook("prompt", async (event: any) => {
        try {
          const dir = await dirOfSession(event?.sessionID);
          handleSessionEvent({ type: "session.updated" }, { directory: dir, worktree: dir });
        } catch {}
      });

      // Post-tool bookkeeping: V1 tool.execute.after -> V2 hook.
      await ctx.tool.hook("execute.after", async (event: any) => {
        try {
          handleToolAfter({ directory: await dirOfSession(event?.sessionID) });
        } catch {}
      });

      // Tools: same 9 tools, V2 registration.
      const getDir = (tctx: any) => dirOfSession(tctx?.sessionID);
      await ctx.tool.transform((editor: any) => {
        editor.add(buildZennoDoctor(getDir));
        editor.add(buildZennoCostReport(getDir));
        editor.add(buildZennoMemory(getDir));
        editor.add(buildZennoGraph(getDir));
        editor.add(buildZennoTraceExport(getDir));
        editor.add(buildZennoConfigExport(getDir));
        editor.add(buildZennoConfigImport(getDir));
        editor.add(buildZennoBoundedResearch(getDir));
        editor.add(buildZennoPlanStressTest(getDir));
      });

      return () => controller.abort();
    },
  }),
  server,
};
