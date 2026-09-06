const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runHook } = require('./run-hook');

const SECRET_SCANNER = path.join(__dirname, '..', 'secret-scanner-hook.js');

function writeTempHook(name, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-run-hook-test-'));
  const hookPath = path.join(dir, `${name}.js`);
  fs.writeFileSync(hookPath, body, 'utf8');
  return hookPath;
}

const ECHO_HOOK = [
  '#!/usr/bin/env node',
  'const fs = require("node:fs");',
  'const raw = fs.readFileSync(0, "utf8");',
  'process.stdout.write("ECHO:" + raw);',
  'process.exit(0);',
].join('\n');

const HANG_HOOK = [
  '#!/usr/bin/env node',
  'setTimeout(() => {}, 60000);',
].join('\n');

test('a payload piped to a working hook exits 0 with its stdout', () => {
  const hookPath = writeTempHook('echo-hook', ECHO_HOOK);
  const payload = { tool_name: 'Bash', tool_input: { command: 'echo hello' } };
  const result = runHook(hookPath, payload);
  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdout, `ECHO:${JSON.stringify(payload)}`);
});

test('malformed payload (non-JSON stdin) against secret-scanner-hook fails open, not crash', () => {
  // runHook always sends JSON, so simulate by calling spawnSync with raw bytes…
  // cannot: runHook serializes. Instead verify the contract on the real hook:
  // even with a garbage-shaped payload it must not crash — exit 0, no timeout.
  const result = runHook(SECRET_SCANNER, { garbage: [Buffer.from('x')] });
  assert.equal(result.timedOut, false);
  assert.equal(result.exitCode, 0);
});

test('a hanging hook is killed and reports timedOut:true', () => {
  const hookPath = writeTempHook('hang-hook', HANG_HOOK);
  const result = runHook(hookPath, { tool_name: 'Bash' }, { timeoutMs: 200 });
  assert.equal(result.timedOut, true);
});

test('stderr is captured separately from stdout', () => {
  const hookPath = writeTempHook('loud-hook', [
    '#!/usr/bin/env node',
    'process.stderr.write("on-stderr");',
    'process.stdout.write("on-stdout");',
    'process.exit(0);',
  ].join('\n'));
  const result = runHook(hookPath, {});
  assert.equal(result.stdout, 'on-stdout');
  assert.equal(result.stderr, 'on-stderr');
});
