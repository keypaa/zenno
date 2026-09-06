const path = require('node:path');

// Commands that can reveal file content to the model, directly or
// indirectly. This list is deliberately not exhaustive (e.g. it won't
// catch a custom script that cats a file internally) — it covers the
// realistic, common cases an agent would actually reach for.
const READ_COMMANDS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'fgrep',
  'strings', 'xxd', 'od', 'sed', 'awk', 'tac', 'nl',
]);

// Pragmatic scope, not a full shell parser: splits on whitespace (doesn't
// handle quoted arguments containing spaces) and treats every non-flag
// token after the command name as a candidate path, rather than trying to
// know each command's specific argument grammar (e.g. that grep's first
// non-flag argument is a search pattern, not a path). Over-including a
// few non-path tokens as "candidates" is harmless — they simply won't
// match any deny pattern. Same disclosed-limitation category as the
// Secret Scanner's classifyGitCommand.
//
// The command name is checked by basename, not the raw token — a plain
// equality check against "cat" let "/bin/cat .env" bypass detection
// entirely, since "/bin/cat" never equals "cat" under Set membership.
function extractFilePathsFromBashCommand(command) {
  const segments = command.split(/&&|;|\|/).map((s) => s.trim());
  const candidates = [];

  for (const segment of segments) {
    const tokens = segment.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const cmdName = path.basename(tokens[0]);
    if (!READ_COMMANDS.has(cmdName)) continue;

    for (const token of tokens.slice(1)) {
      if (token.startsWith('-')) continue; // skip flags
      candidates.push(token);
    }
  }

  return candidates;
}

module.exports = { extractFilePathsFromBashCommand, READ_COMMANDS };
