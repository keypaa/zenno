const { execFileSync } = require('node:child_process');

function isOnPath(binaryName) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  try {
    execFileSync(finder, [binaryName], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkExternalTools() {
  return {
    rg: isOnPath('rg'),
    astGrep: isOnPath('ast-grep'),
  };
}

module.exports = { checkExternalTools, isOnPath };
