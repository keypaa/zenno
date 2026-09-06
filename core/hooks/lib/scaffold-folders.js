const fs = require('node:fs');
const path = require('node:path');

const SUBFOLDERS = ['graph', 'traces', 'telemetry', 'audit', 'plans', 'specs'];
const GITIGNORE_ENTRIES = ['zenno/traces/', 'zenno/telemetry/', 'zenno/graph/'];

function scaffoldFolders(targetRepoRoot) {
  const zennoRoot = path.join(targetRepoRoot, 'zenno');
  const created = [];

  if (!fs.existsSync(zennoRoot)) {
    fs.mkdirSync(zennoRoot, { recursive: true });
    created.push(zennoRoot);
  }

  for (const sub of SUBFOLDERS) {
    const subPath = path.join(zennoRoot, sub);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
      created.push(subPath);
    }
  }

  const gitignorePath = path.join(targetRepoRoot, '.gitignore');
  let gitignoreContent = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, 'utf8')
    : '';
  const existingLines = new Set(
    gitignoreContent.split('\n').map((line) => line.trim())
  );
  const linesToAdd = GITIGNORE_ENTRIES.filter(
    (entry) => !existingLines.has(entry)
  );

  if (linesToAdd.length > 0) {
    const separator =
      gitignoreContent.length > 0 && !gitignoreContent.endsWith('\n')
        ? '\n'
        : '';
    gitignoreContent += `${separator}${linesToAdd.join('\n')}\n`;
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
    created.push(gitignorePath);
  }

  return { created };
}

module.exports = { scaffoldFolders, SUBFOLDERS, GITIGNORE_ENTRIES };
