// Shared testing helper (Plan 12, reusable by future plans testing
// hook-process behavior): spawn a hook script as a real subprocess with a
// synthetic stdin payload, returning its exit code and captured streams.
// A hook that hangs is killed by the hard timeout and reported as timedOut.
const { spawnSync } = require('node:child_process');

function runHook(hookPath, payload, options = {}) {
  const result = spawnSync('node', [hookPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 5000,
  });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    timedOut: result.error !== undefined,
  };
}

module.exports = { runHook };
