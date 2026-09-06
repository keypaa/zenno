#!/usr/bin/env node
const fs = require('node:fs');
const { getStagedDiff, getUnpushedDiff } = require('./get-git-diffs');
const { scanForSecrets } = require('./scan-for-secrets');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Deliberately simple substring/regex matching, not a full shell parser.
// This catches the common, realistic cases (git commit -m "...",
// git add . && git commit -m "...", git push origin main) but a
// determined attempt to obfuscate the command (aliases, base64-encoded
// subshells, etc.) could evade it. Documented as a known limitation
// rather than silently assumed to be airtight.
//
// Requires the command name to be followed by whitespace or end-of-string
// (not just a \b word boundary) — a plain \bgit\s+commit\b also matched
// "git commit-tree ...", an unrelated plumbing command, since \b matches
// at the letter-to-hyphen boundary too.
function classifyGitCommand(command) {
  if (/\bgit\s+commit(\s|$)/.test(command)) return 'commit';
  if (/\bgit\s+push(\s|$)/.test(command)) return 'push';
  return null;
}

function formatFindingsMessage(findings) {
  const lines = findings
    .filter((f) => f.confidence === 'high')
    .map((f) => `  - ${f.type} on line ${f.line}: ${f.matchedText}`);
  return [
    'Zenno Secret Scanner: blocked — high-confidence secret(s) detected:',
    ...lines,
    '',
    'If this is a known-safe fixture or test credential, add it to',
    'shield.secretScanner.allowlist in zenno/config.json — never bypass',
    'this by disabling the hook.',
  ].join('\n');
}

function main() {
  const payload = readStdinJson();
  const command = payload.tool_input?.command || '';
  const cwd = payload.cwd || process.cwd();

  const kind = classifyGitCommand(command);
  if (kind === null) {
    process.exit(0); // not a commit/push — not this hook's concern
  }

  const diff = kind === 'commit' ? getStagedDiff(cwd) : getUnpushedDiff(cwd);
  if (diff.trim().length === 0) {
    process.exit(0); // nothing to scan
  }

  const result = scanForSecrets(diff, cwd);
  if (result.hasHighConfidenceMatch) {
    process.stderr.write(formatFindingsMessage(result.findings) + '\n');
    process.exit(2); // hard block — exit 2 is the only code that blocks
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { classifyGitCommand, formatFindingsMessage };
