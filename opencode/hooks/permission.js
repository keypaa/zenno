/**
 * Zenno for OpenCode — permission adapter (pure, host-agnostic)
 *
 * Exposes a single `handlePermissionAsk(perm, output, ctx)` that mirrors
 * the 5 Claude PreToolUse guard hooks + cap hook, but via OpenCode's
 * `permission.ask` shape: {type, pattern, sessionID, title, metadata, time}
 * -> output {status: "allow"|"deny", reason?}.
 *
 * Extracted so plugin.ts and tests share one implementation (no mixed
 * require/flat logic). All core imports are lazy-require'd to keep this
 * file importable in tests without side effects.
 */
const path = require("node:path");
const fs = require("node:fs");

function permissionToCommand(perm) {
  return (
    perm?.metadata?.command ||
    perm?.metadata?.cmd ||
    (typeof perm?.pattern === "string" ? perm.pattern : "") ||
    perm?.title ||
    ""
  );
}

function permissionToFilePath(perm) {
  if (typeof perm?.pattern === "string" && perm.pattern.includes("/")) return perm.pattern;
  if (Array.isArray(perm?.pattern) && perm.pattern[0]) return perm.pattern[0];
  return perm?.metadata?.file_path || perm?.metadata?.path || perm?.metadata?.filePath || null;
}

function permissionToolName(perm) {
  const raw = (perm?.type || perm?.pattern || perm?.title || "").toString().toLowerCase();
  if (raw.includes("read")) return "Read";
  if (raw.includes("write")) return "Write";
  if (raw.includes("edit")) return "Edit";
  if (raw.includes("bash") || raw.includes("shell") || raw.includes("command")) return "Bash";
  if (raw.includes("agent") || raw.includes("task")) return "Agent";
  return perm?.type || "unknown";
}

async function handlePermissionAsk(perm, output, ctx) {
  const projectDir = ctx?.projectDir || perm?.metadata?.cwd || process.cwd();
  const pluginRoot = ctx?.pluginRoot || path.resolve(__dirname, "../..");
  const toolName = permissionToolName(perm);
  const cwd = perm?.metadata?.cwd || projectDir;
  const command = permissionToCommand(perm);
  const filePath = permissionToFilePath(perm);

  // Lazy requires — keeps module load side-effect free for tests
  const { readGuardConfig } = require("../../core/hooks/lib/read-guard-config.js");
  const { shouldBlockPath } = require("../../core/hooks/lib/should-block-path.js");
  const { extractFilePathsFromBashCommand } = require("../../core/hooks/lib/extract-bash-file-paths.js");
  const { classifyInstallCommand } = require("../../core/hooks/lib/classify-install-command.js");
  const { detectTyposquat } = require("../../core/hooks/lib/detect-typosquat.js");
  const { isInManifest } = require("../../core/hooks/lib/check-manifest.js");
  const { classifySelfModTarget } = require("../../core/hooks/lib/classify-self-mod-target.js");
  const { isOverrideActive } = require("../../core/hooks/lib/check-self-mod-override.js");
  const { extractWriteTargetsFromBashCommand } = require("../../core/hooks/lib/extract-write-targets.js");
  const { readAgentTeamState } = require("../../core/hooks/lib/agent-team-state.js");
  const { readAgentTeamCaps } = require("../../core/hooks/lib/read-agent-team-caps.js");
  const { getStagedDiff, getUnpushedDiff } = require("../../core/hooks/lib/get-git-diffs.js");

  // Haruspex Guard — Write|Edit|Bash
  if (["Write", "Edit", "Bash"].includes(toolName)) {
    let candidates = [];
    if (toolName === "Bash" && command) {
      try {
        candidates = extractWriteTargetsFromBashCommand(command).map((p) =>
          path.isAbsolute(p) ? p : path.resolve(cwd, p),
        );
      } catch {}
    } else if (filePath) {
      candidates = [path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath)];
    }
    for (const p of candidates) {
      const tier = classifySelfModTarget(p, pluginRoot, cwd);
      if (tier === "security-critical" && !isOverrideActive()) {
        output.status = "deny";
        output.reason =
          `Zenno Haruspex Guard: blocked write to "${p}".\n\n` +
          "This is a security-critical Zenno file (guard logic, hook\n" +
          "registration, or the canonical config). It can only be modified by\n" +
          "setting ZENNO_ALLOW_SELF_MOD=1 before starting this session — never\n" +
          "from within a conversation.";
        return;
      }
    }
  }

  // Confidential File Guard — Read|Bash
  if (["Read", "Bash"].includes(toolName)) {
    let candidates = [];
    if (toolName === "Read" && filePath) candidates = [filePath];
    else if (toolName === "Bash" && command) {
      try { candidates = extractFilePathsFromBashCommand(command); } catch {}
    }
    if (candidates.length > 0) {
      try {
        const config = readGuardConfig(cwd);
        const blocked = candidates.find((p) => shouldBlockPath(p, config));
        if (blocked) {
          output.status = "deny";
          output.reason =
            `Zenno Confidential File Guard: blocked read of "${blocked}".\n\n` +
            "This path matches a configured sensitive-file pattern. If you need\n" +
            "this file readable, edit shield.confidentialFileGuard.denyPatterns\n" +
            "(or add an explicit allow pattern) in zenno/config.json yourself —\n" +
            "this cannot be approved from within the conversation.";
          return;
        }
      } catch {}
    }
  }

  // Provenance Guard — Bash (install commands)
  if (toolName === "Bash" && command) {
    const install = classifyInstallCommand(command);
    if (install) {
      if (install.isGlobal) {
        const blockGlobal = (() => {
          const cfgPath = path.join(cwd, "zenno", "config.json");
          if (!fs.existsSync(cfgPath)) return true;
          try { const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); return cfg?.shield?.provenanceGuard?.blockGlobalInstalls ?? true; } catch { return true; }
        })();
        if (blockGlobal) {
          output.status = "deny";
          output.reason = "Zenno Provenance Guard: blocked — global/system-wide installs are disabled by default. Set shield.provenanceGuard.blockGlobalInstalls to false in zenno/config.json to allow them.";
          return;
        }
      }
      for (const pkg of install.packages || []) {
        if (isInManifest(cwd, install.ecosystem, pkg)) continue;
        const typo = detectTyposquat(pkg, install.ecosystem);
        if (typo?.isTyposquat) {
          output.status = "deny";
          output.reason = `Zenno Provenance Guard: blocked — "${pkg}" looks like a typosquat of the well-known package "${typo.suspectedRealPackage}"(edit distance ${typo.distance}). If this is genuinely the package you want, install it manually outside this session, or add it to the manifest yourself first.`;
          return;
        }
      }
    }
  }

  // Secret Scanner — Bash git commit/push
  if (toolName === "Bash" && command) {
    let classifyGitCommand;
    try { ({ classifyGitCommand } = require("../../core/hooks/lib/secret-scanner-hook.js")); } catch {}
    const isCommitOrPush = typeof classifyGitCommand === "function" ? classifyGitCommand(command) !== null : /\bgit\s+(commit|push)(\s|$)/.test(command);
    if (isCommitOrPush) {
      try {
        const kind = typeof classifyGitCommand === "function" ? classifyGitCommand(command) : command.includes("commit") ? "commit" : "push";
        const diff = kind === "commit" ? getStagedDiff(cwd) : getUnpushedDiff(cwd);
        if (diff && diff.trim().length > 0) {
          const { scanForSecrets } = require("../../core/hooks/lib/scan-for-secrets.js");
          const result = scanForSecrets(diff, cwd);
          if (result.hasHighConfidenceMatch) {
            const lines = result.findings.filter((f) => f.confidence === "high").map((f) => `  - ${f.type} on line ${f.line}: ${f.matchedText}`);
            output.status = "deny";
            output.reason = "Zenno Secret Scanner: blocked — high-confidence secret(s) detected:\n" + lines.join("\n") + "\n\nIf this is a known-safe fixture or test credential, add it to\nshield.secretScanner.allowlist in zenno/config.json — never bypass\nthis by disabling the hook.";
            return;
          }
        }
      } catch {}
    }
  }

  // Agent Team caps — Agent|Task
  if (["Agent", "Task"].includes(toolName)) {
    try {
      const state = readAgentTeamState(cwd);
      const caps = readAgentTeamCaps(cwd);
      const callerId = perm?.metadata?.agent_id || perm?.metadata?.callerAgentId || null;
      const callerDepth = callerId ? (state.depthByAgentId?.[callerId] ?? 1) : 0;
      const newDepth = callerDepth + 1;
      const newConcurrent = (state.currentActive || 0) + 1;
      const newTotal = (state.totalSpawned || 0) + 1;
      let reason = null;
      if (newDepth > caps.depthCap) reason = `depth-cap-exceeded (would be depth ${newDepth}, cap is ${caps.depthCap})`;
      else if (newConcurrent > caps.concurrentCap) reason = `concurrent-cap-exceeded (would be ${newConcurrent} active, cap is ${caps.concurrentCap})`;
      else if (newTotal > caps.totalPerTaskCap) reason = `total-per-task-cap-exceeded (would be ${newTotal} spawned, cap is ${caps.totalPerTaskCap})`;
      if (reason) {
        output.status = "deny";
        output.reason = `Zenno Agent Team cap: blocked — ${reason}. Configure agentTeam caps in zenno/config.json if this limit is genuinely too tight for a legitimate workflow.`;
        return;
      }
    } catch {}
  }

  output.status = "allow";
}

module.exports = { handlePermissionAsk, permissionToCommand, permissionToFilePath, permissionToolName };
