const path = require('node:path');

const WRITE_COMMANDS = new Set(['mv', 'rm', 'cp', 'tee']);

// Matches shell output redirection (> or >>) followed by a path-like
// token, anywhere in a command segment — independent of the leading
// command name, since redirection is shell syntax, not a command itself
// (e.g. "echo malicious > core/hooks/hooks.json").
const REDIRECT_PATTERN = />>?\s*([^\s&|;]+)/g;

// Pragmatic scope, not a full shell parser — same disclosed-limitation
// category as the Confidential File Guard's extractor. sed's script
// argument becomes a harmless extra candidate alongside its real file
// target, same tradeoff as grep's pattern argument in the read-side guard.
function extractWriteTargetsFromBashCommand(command) {
  const segments = command.split(/&&|;|\|/).map((s) => s.trim());
  const candidates = [];

  for (const segment of segments) {
    const tokens = segment.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const cmdName = path.basename(tokens[0]);
      const isSedInPlace = cmdName === 'sed' && tokens.includes('-i');

      if (WRITE_COMMANDS.has(cmdName) || isSedInPlace) {
        for (const token of tokens.slice(1)) {
          if (token.startsWith('-')) continue;
          candidates.push(token);
        }
      }
    }

    for (const match of segment.matchAll(REDIRECT_PATTERN)) {
      candidates.push(match[1]);
    }
  }

  return candidates;
}

module.exports = { extractWriteTargetsFromBashCommand, WRITE_COMMANDS };
