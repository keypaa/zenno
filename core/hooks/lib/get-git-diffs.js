const { execFileSync } = require('node:child_process');

function getStagedDiff(cwd) {
  try {
    return execFileSync('git', ['diff', '--cached'], { cwd, encoding: 'utf8' });
  } catch {
    return ''; // no staged changes, or not a git repo — nothing to scan
  }
}

function getUnpushedDiff(cwd) {
  try {
    return execFileSync('git', ['log', '@{u}..HEAD', '-p'], {
      cwd,
      encoding: 'utf8',
    });
  } catch {
    // No upstream configured (e.g. first push of a new branch) — @{u}
    // resolution fails here. Falling back to just the most recent commit's
    // diff is a deliberate, documented degraded behavior: it's narrower
    // than the ideal "everything not yet on the remote," but it's safer
    // than skipping the scan entirely, which would leave this checkpoint
    // silently blind on exactly the case (new branch, first push) where a
    // secret is most likely to have never been scanned before.
    try {
      return execFileSync('git', ['show', '-p', 'HEAD'], {
        cwd,
        encoding: 'utf8',
      });
    } catch {
      return ''; // no commits at all yet
    }
  }
}

module.exports = { getStagedDiff, getUnpushedDiff };
