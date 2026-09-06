const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkInstallHealth,
  checkExternalTools,
  checkBrokenReferences,
  checkConfigConsistency,
  summarize,
  doctorExitCode,
} = require('./doctor-checks');

function validConfig() {
  return {
    version: 1,
    shield: {},
    agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 },
    telemetry: { enabled: false, recordContent: false },
    traces: { defaultMode: 'raw' },
  };
}

function goodMemory() {
  return { rootExists: true, gitDirExists: true, gitOk: true };
}

function goodMarker() {
  return { initializedAt: '2026-09-06T00:00:00.000Z' };
}

function findCheck(checks, namePattern) {
  return checks.find((c) => namePattern.test(c.name));
}

// --- install health: 10 tests ---

test('null marker → WARN (bootstrap marker missing)', () => {
  const checks = checkInstallHealth({ marker: null, config: validConfig(), configErrors: null, memory: goodMemory() });
  const c = findCheck(checks, /bootstrap/i);
  assert.equal(c.status, 'WARN');
});

test('marker without an initializedAt timestamp → WARN', () => {
  const checks = checkInstallHealth({ marker: { initializedAt: 123 }, config: validConfig(), configErrors: null, memory: goodMemory() });
  const c = findCheck(checks, /bootstrap/i);
  assert.equal(c.status, 'WARN');
});

test('healthy marker + valid config + good memory → all OK', () => {
  const checks = checkInstallHealth({ marker: goodMarker(), config: validConfig(), configErrors: null, memory: goodMemory() });
  assert.ok(checks.length >= 3);
  for (const c of checks) assert.equal(c.status, 'OK');
});

test('config null with no parse error → WARN (bootstrap will seed it)', () => {
  const checks = checkInstallHealth({ marker: goodMarker(), config: null, configErrors: null, memory: goodMemory() });
  const c = findCheck(checks, /config/i);
  assert.equal(c.status, 'WARN');
  assert.match(c.detail, /seed/i);
});

test('config null with a parse error → FAIL quoting the error', () => {
  const checks = checkInstallHealth({ marker: goodMarker(), config: null, configErrors: 'Unexpected token }', memory: goodMemory() });
  const c = findCheck(checks, /config/i);
  assert.equal(c.status, 'FAIL');
  assert.match(c.detail, /Unexpected token/);
});

test('schema-invalid config (depthCap "three") → FAIL naming depthCap with import fix', () => {
  const config = validConfig();
  config.agentTeam.depthCap = 'three';
  const checks = checkInstallHealth({ marker: goodMarker(), config, configErrors: null, memory: goodMemory() });
  const c = findCheck(checks, /config/i);
  assert.equal(c.status, 'FAIL');
  assert.match(c.detail, /depthCap/);
  assert.match(c.fix, /config-import-cli/);
});

test('memory null → WARN (no memory directory configured)', () => {
  const checks = checkInstallHealth({ marker: goodMarker(), config: validConfig(), configErrors: null, memory: null });
  const c = findCheck(checks, /memory/i);
  assert.equal(c.status, 'WARN');
  assert.match(c.detail, /no memory directory configured/i);
});

test('memory root without .git → FAIL (history lost, do not re-init blindly)', () => {
  const checks = checkInstallHealth({
    marker: goodMarker(), config: validConfig(), configErrors: null,
    memory: { rootExists: true, gitDirExists: false, gitOk: false },
  });
  const c = findCheck(checks, /memory/i);
  assert.equal(c.status, 'FAIL');
  assert.match(c.detail, /history lost/i);
  assert.match(c.detail, /do not re-init blindly/i);
});

test('memory .git present but git status failed → WARN', () => {
  const checks = checkInstallHealth({
    marker: goodMarker(), config: validConfig(), configErrors: null,
    memory: { rootExists: true, gitDirExists: true, gitOk: false },
  });
  const c = findCheck(checks, /memory/i);
  assert.equal(c.status, 'WARN');
});

test('shield not an object → FAIL naming shield', () => {
  const config = validConfig();
  config.shield = 'yes';
  const checks = checkInstallHealth({ marker: goodMarker(), config, configErrors: null, memory: goodMemory() });
  const c = findCheck(checks, /config/i);
  assert.equal(c.status, 'FAIL');
  assert.match(c.detail, /shield/);
});

// --- external tools: 6 tests ---

test('rg + ctags present → OK', () => {
  const checks = checkExternalTools({ tools: { rg: true, ctags: true } });
  assert.ok(checks.every((c) => c.status === 'OK'));
});

test('rg missing → FAIL naming rg', () => {
  const checks = checkExternalTools({ tools: { rg: false, ctags: true } });
  const c = findCheck(checks, /ripgrep|rg/i);
  assert.equal(c.status, 'FAIL');
  assert.match(c.detail, /rg/);
});

test('ctags missing → FAIL naming ctags', () => {
  const checks = checkExternalTools({ tools: { rg: true, ctags: false } });
  const c = findCheck(checks, /ctags/i);
  assert.equal(c.status, 'FAIL');
  assert.match(c.detail, /ctags/);
});

test('both missing → FAIL naming both', () => {
  const checks = checkExternalTools({ tools: { rg: false, ctags: false } });
  const joined = checks.map((c) => c.detail).join(' ');
  assert.match(joined, /rg/);
  assert.match(joined, /ctags/);
  assert.ok(checks.some((c) => c.status === 'FAIL'));
});

test('fix names the Arch package for the missing tool only', () => {
  const checks = checkExternalTools({ tools: { rg: false, ctags: true } });
  const rgCheck = findCheck(checks, /ripgrep|rg/i);
  assert.match(rgCheck.fix, /pacman -S ripgrep(?! universal-ctags)/);
});

test('fix names the Debian package for the missing tool only', () => {
  const checks = checkExternalTools({ tools: { rg: true, ctags: false } });
  const ctagsCheck = findCheck(checks, /ctags/i);
  assert.match(ctagsCheck.fix, /apt install universal-ctags/);
});

// --- broken references: 5 tests ---

test('no targetDir configured → WARN (traces will not export)', () => {
  const checks = checkBrokenReferences({ config: validConfig(), repoRoot: '/repo', pathExists: () => true });
  const c = findCheck(checks, /reference/i);
  assert.equal(c.status, 'WARN');
  assert.match(c.detail, /traces will not export/);
});

test('targetDir present and resolvable → OK', () => {
  const config = validConfig();
  config.traces.targetDir = 'zenno/traces';
  const seen = [];
  const checks = checkBrokenReferences({
    config, repoRoot: '/repo', pathExists: (p) => { seen.push(p); return true; },
  });
  const c = findCheck(checks, /reference/i);
  assert.equal(c.status, 'OK');
  assert.ok(seen.some((p) => p.includes('zenno') && p.includes('traces')));
});

test('targetDir present but unresolvable → FAIL naming the path', () => {
  const config = validConfig();
  config.traces.targetDir = 'zenno/traces';
  const checks = checkBrokenReferences({ config, repoRoot: '/repo', pathExists: () => false });
  const c = findCheck(checks, /reference/i);
  assert.equal(c.status, 'FAIL');
  assert.match(c.detail, /zenno\/traces/);
});

test('FAIL detail quotes the unresolved path', () => {
  const config = validConfig();
  config.traces.targetDir = 'elsewhere/out';
  const checks = checkBrokenReferences({ config, repoRoot: '/repo', pathExists: () => false });
  const c = findCheck(checks, /reference/i);
  assert.match(c.detail, /elsewhere\/out/);
});

test('FAIL fix points at traces.targetDir', () => {
  const config = validConfig();
  config.traces.targetDir = 'elsewhere/out';
  const checks = checkBrokenReferences({ config, repoRoot: '/repo', pathExists: () => false });
  const c = findCheck(checks, /reference/i);
  assert.match(c.fix, /traces\.targetDir/);
});

// --- config consistency: 4 tests ---

test('healthy config → OK', () => {
  const checks = checkConfigConsistency({ config: validConfig() });
  assert.ok(checks.every((c) => c.status === 'OK'));
});

test('otlp mode + empty targetDir → WARN (nothing will be exported)', () => {
  const config = validConfig();
  config.traces.defaultMode = 'otlp';
  config.traces.targetDir = '';
  const checks = checkConfigConsistency({ config });
  assert.ok(checks.some((c) => c.status === 'WARN'));
  assert.match(checks.map((c) => c.detail).join(' '), /nothing will be exported/);
});

test('raw mode + empty targetDir → OK (no contradiction)', () => {
  const checks = checkConfigConsistency({ config: validConfig() });
  assert.ok(checks.every((c) => c.status === 'OK'));
});

test('otlp mode + configured targetDir → OK', () => {
  const config = validConfig();
  config.traces.defaultMode = 'otlp';
  config.traces.targetDir = 'zenno/traces';
  const checks = checkConfigConsistency({ config });
  assert.ok(checks.every((c) => c.status === 'OK'));
});

// --- summarize: 4 tests ---

test('summarize counts an all-OK list', () => {
  const s = summarize([
    { name: 'a', status: 'OK' },
    { name: 'b', status: 'OK' },
    { name: 'c', status: 'OK' },
  ]);
  assert.deepEqual(s, { total: 3, ok: 3, warn: 0, fail: 0 });
});

test('summarize counts a mixed list', () => {
  const s = summarize([
    { name: 'a', status: 'OK' },
    { name: 'b', status: 'WARN' },
    { name: 'c', status: 'FAIL' },
    { name: 'd', status: 'WARN' },
  ]);
  assert.deepEqual(s, { total: 4, ok: 1, warn: 2, fail: 1 });
});

test('summarize of an empty list is all zeros', () => {
  assert.deepEqual(summarize([]), { total: 0, ok: 0, warn: 0, fail: 0 });
});

test('summarize ignores unknown statuses in counts but not in total', () => {
  const s = summarize([{ name: 'a', status: 'SKIPPED' }]);
  assert.deepEqual(s, { total: 1, ok: 0, warn: 0, fail: 0 });
});

// --- exit code: 3 tests ---

test('all OK → exit 0', () => {
  assert.equal(doctorExitCode({ total: 2, ok: 2, warn: 0, fail: 0 }), 0);
});

test('a single WARN → exit 1', () => {
  assert.equal(doctorExitCode({ total: 2, ok: 1, warn: 1, fail: 0 }), 1);
});

test('a single FAIL → exit 1', () => {
  assert.equal(doctorExitCode({ total: 2, ok: 1, warn: 0, fail: 1 }), 1);
});
