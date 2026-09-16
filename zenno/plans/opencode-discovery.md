# OpenCode Discovery Pin

Date: 2026-09-06 (Phase 0, branch opencode-overlay off 681e48)

## Mise binary (DO NOT use bare `opencode`)

- Shim (DO NOT invoke): `/home/keypaa/.local/share/mise/shims/opencode` -> mise
- Canonical binary to use everywhere (tests, probes, scripts): `/home/keypaa/.local/share/mise/installs/opencode/latest/opencode`
- `mise where opencode` => `/home/keypaa/.local/share/mise/installs/opencode/1.18.30` (`latest` symlinks to `1.18.30`)
- Version: 1.18.30
- Rule: every spawn/test helper must use the absolute path or `$OPENCODE_BIN` env. Bare `opencode` on PATH is the shim and must never be called.

## SDK surface (from @opencode-ai/plugin 1.18.x dist/index.d.ts)

Plugin shape:
```ts
export type PluginModule = { id?: string; server: Plugin }
export type Plugin = (input: PluginInput) => Promise<Hooks>
export interface Hooks {
  "permission.ask"?: (input: Permission, output: {status: "ask"|"deny"|"allow"}) => void
  "tool.execute.before"?: (input: {tool, sessionID, callID}, output: {args}) => void
  "tool.execute.after"?: (input: {tool, sessionID, callID, args}, output: {title, output, metadata}) => void
  event?: (input: {event: Event}) => void
  tool?: Record<string, ToolDefinition>
}
```

## Claude → OpenCode mapping (hypothesis, to verify live in Phase 0)

| Claude | OpenCode | Blocking? | Notes |
|---|---|---|---|
| SessionStart | event: session.created / session.updated | non-blocking | bootstrap, memory-read, graph-nudge, doctor-nudge |
| PreToolUse (Bash→secret-scanner) | permission.ask OR tool.execute.before | blocking | docs say permission.asked for allow/deny; try permission.ask first |
| PreToolUse (Read|Bash→confidential) | permission.ask | blocking | check tool name mapping |
| PreToolUse (Bash→provenance) | permission.ask | blocking | |
| PreToolUse (Write|Edit|Bash→haruspex) | permission.ask | blocking | needs plugin root (argv vs import.meta.url) |
| PreToolUse (Agent|Task→cap) | permission.ask | blocking | agent spawn shape differs |
| SubagentStart/Stop | event: session.* (TBD live probe) | non-blocking | agent lifecycle |
| PostToolUse | tool.execute.after | non-blocking | telemetry, guard-warning |
| Stop | event: session.idle | non-blocking | cap near-miss, memory sweep |

## Live probe TODO (gates Phase 1)

Create throwaway plugin at /tmp/opencode-probe/plugin.ts that logs JSON.stringify(input,null,2) for each hook above, trigger via opencode run, snapshot shapes, diff against Claude `{tool_name, tool_input, cwd, agent_id}`.

Pending: run via `$OPENCODE_BIN` in this repo.
