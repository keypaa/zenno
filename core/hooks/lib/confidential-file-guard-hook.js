#!/usr/bin/env node
const fs = require('node:fs');
const { readGuardConfig } = require('./read-guard-config');
const { shouldBlockPath } = require('./should-block-path');
const { extractFilePathsFromBashCommand } = require('./extract-bash-file-paths');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Returns every candidate path this tool call would expose the content
// of, regardless of whether it came from the Read tool directly or a
// Bash command that reads file content indirectly.
function getCandidatePaths(payload) {
  if (payload.tool_name === 'Read') {
    const filePath = payload.tool_input?.file_path;
    return filePath ? [filePath] : [];
  }
  if (payload.tool_name === 'Bash') {
    const command = payload.tool_input?.command || '';
    return extractFilePathsFromBashCommand(command);
  }
  return [];
}

function formatBlockMessage(blockedPath) {
  return [
    `Zenno Confidential File Guard: blocked read of "${blockedPath}".`,
    '',
    'This path matches a configured sensitive-file pattern. If you need',
    'this file readable, edit shield.confidentialFileGuard.denyPatterns',
    '(or add an explicit allow pattern) in zenno/config.json yourself —',
    'this cannot be approved from within the conversation.',
  ].join('\n');
}

function main() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const candidates = getCandidatePaths(payload);

  if (candidates.length === 0) {
    process.exit(0);
  }

  const config = readGuardConfig(cwd);
  const blocked = candidates.find((p) => shouldBlockPath(p, config));

  if (blocked) {
    process.stderr.write(formatBlockMessage(blocked) + '\n');
    process.exit(2);
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { getCandidatePaths, formatBlockMessage };
