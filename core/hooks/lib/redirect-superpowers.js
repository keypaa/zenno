const fs = require('node:fs');
const path = require('node:path');

const MARKER = '<!-- zenno:superpowers-redirect -->';
const BLOCK = `${MARKER}
## Zenno: Superpowers output location override

When using the superpowers:writing-plans skill, save plans to \`zenno/plans/\`
instead of the default \`docs/superpowers/plans/\`.

When using the superpowers:brainstorming skill, save specs to \`zenno/specs/\`
instead of the default \`docs/superpowers/specs/\`.
${MARKER}
`;

function writeSuperpowersRedirect(targetRepoRoot) {
  const claudeMdPath = path.join(targetRepoRoot, 'CLAUDE.md');
  const existing = fs.existsSync(claudeMdPath)
    ? fs.readFileSync(claudeMdPath, 'utf8')
    : '';

  if (existing.includes(MARKER)) {
    return { path: claudeMdPath, updated: false };
  }

  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : existing.length > 0 ? '\n' : '';
  fs.writeFileSync(claudeMdPath, `${existing}${separator}${BLOCK}`, 'utf8');
  return { path: claudeMdPath, updated: true };
}

module.exports = { writeSuperpowersRedirect, MARKER };
