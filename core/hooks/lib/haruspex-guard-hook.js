#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { classifySelfModTarget } = require('./classify-self-mod-target');
const { extractWriteTargetsFromBashCommand } = require('./extract-write-targets');
const { isOverrideActive } = require('./check-self-mod-override');
const { appendJournalEntry } = require('./append-journal-entry');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Returns every path this tool call would write to, regardless of tool.
function getCandidatePaths(payload, cwd) {
  let raw = [];
  if (payload.tool_name === 'Write' || payload.tool_name === 'Edit') {
    const filePath = payload.tool_input?.file_path;
    raw = filePath ? [filePath] : [];
  } else if (payload.tool_name === 'Bash') {
    raw = extractWriteTargetsFromBashCommand(payload.tool_input?.command || '');
  }
  // Resolve relative paths against cwd so classification always compares
  // absolute paths, regardless of how the tool call expressed the target.
  return raw.map((p) => (path.isAbsolute(p) ? p : path.resolve(cwd, p)));
}

function formatBlockMessage(blockedPath) {
  return [
    `Zenno Haruspex Guard: blocked write to "${blockedPath}".`,
    '',
    'This is a security-critical Zenno file (guard logic, hook',
    'registration, or the canonical config). It can only be modified by',
    'setting ZENNO_ALLOW_SELF_MOD=1 before starting this session — never',
    'from within a conversation, since a prompt injection could otherwise',
    'try to talk an agent into disabling its own guards.',
  ].join('\n');
}

function main() {
  const pluginRoot = process.argv[2];
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const targetRepoRoot = cwd;

  if (!pluginRoot) {
    // Can't classify anything without knowing the plugin root — fail
    // open rather than crash the tool call outright. This should never
    // happen in practice, since hooks.json always passes it explicitly.
    process.exit(0);
  }

  const candidates = getCandidatePaths(payload, cwd);
  if (candidates.length === 0) {
    process.exit(0);
  }

  const classifications = candidates.map((p) => ({
    path: p,
    tier: classifySelfModTarget(p, pluginRoot, targetRepoRoot),
  }));

  const securityCritical = classifications.find((c) => c.tier === 'security-critical');
  if (securityCritical) {
    if (isOverrideActive()) {
      process.exit(0); // deliberate, session-flag-only override is active
    }
    process.stderr.write(formatBlockMessage(securityCritical.path) + '\n');
    process.exit(2);
  }

  const general = classifications.find((c) => c.tier === 'general');
  if (general) {
    appendJournalEntry(targetRepoRoot, {
      type: 'self-mod-warning',
      path: general.path,
      tier: 'general',
    });
    process.stderr.write(
      `Zenno Haruspex Guard: note — modifying Zenno plugin content at "${general.path}". ` +
        'Not blocked (not security-critical), logged for visibility.\n'
    );
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { getCandidatePaths, formatBlockMessage };
