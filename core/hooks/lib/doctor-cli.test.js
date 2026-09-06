const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LIB_DIR = __dirname;
const DOCTOR_CLI = path.join(LIB_DIR, 'doctor-cli.js');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-doctor-cli-test-'));
}

function writeValidConfig(repo) {
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'zenno', 'traces'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({
      version: 1,
      shield: {},
      agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 },
      telemetry: { enabled: false, recordContent: false },
      traces: { defaultMode: 'raw', targetDir: 'zenno/traces' },
    })
  );
}

function runDoctor(repo, pluginRoot, extraEnv = {}) {
  return spawnSync('node', [DOCTOR_CLI], {
    cwd: repo,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, ...extraEnv },
    encoding: 'utf8',
    timeout: 120000,
  });
}

function provisionedRepo() {
  // A repo the way first-run bootstrap leaves one: marker written last,
  // schema-valid config, memory snapshots dir with a working private git
  // repo (deriveMemoryDir can be redirected at it via HOME).
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'zenno', '.initialized'),
    JSON.stringify({ initializedAt: '2026-09-06T00:00:00.000Z' })
  );
  writeValidConfig(repo);
  const fakeHome = makeTempRepo();
  const slug = repo.replace(/^[A-Za-z]:/, '').split(/[\\/]/).filter(Boolean).join('-');
  const snapshots = path.join(fakeHome, '.claude', 'projects', `-${slug}`, 'memory', 'zenno', 'snapshots');
  fs.mkdirSync(snapshots, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: snapshots });
  spawnSync('git', ['config', '--local', 'user.name', 'zenno-doctor-test'], { cwd: snapshots });
  spawnSync('git', ['config', '--local', 'user.email', 'zenno-doctor-test@localhost'], { cwd: snapshots });
  return { repo, fakeHome };
}

test('doctor passes on a fully provisioned repo: exit 0, only [OK  ] lines', () => {
  const { repo, fakeHome } = provisionedRepo();
  const pluginRoot = path.resolve(LIB_DIR, '..', '..', '..');
  const result = runDoctor(repo, pluginRoot, { HOME: fakeHome });
  assert.equal(result.status, 0, `stderr was:\n${result.stderr}\nstdout was:\n${result.stdout}`);
  assert.match(result.stdout, /\[OK  \]/);
  assert.doesNotMatch(result.stdout, /\[FAIL\]|\[WARN\]/);
  assert.match(result.stdout, /doctor: \d+ checks/);
  assert.match(result.stdout, /\[OK  \] hook sanity: secret-scanner \(should-block\)/);
  assert.match(result.stdout, /\[OK  \] hook sanity: haruspex-guard \(should-block\)/);
  assert.match(result.stdout, /\[OK  \] hook sanity: agent-team-cap \(should-block\)/);
});

test('doctor FAILs loudly on a fixture with an invalid config', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({ version: 1 }) // missing required keys
  );
  const pluginRoot = path.resolve(LIB_DIR, '..', '..', '..');
  const result = runDoctor(repo, pluginRoot);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[FAIL\] config\.json validity/);
  assert.match(result.stdout, /config-import-cli/);
});

test('doctor FAILs on snapshots dir without .git (history-loss message)', () => {
  const repo = makeTempRepo();
  writeValidConfig(repo);
  const fakeHome = makeTempRepo();
  const slug = repo.replace(/^[A-Za-z]:/, '').split(/[\\/]/).filter(Boolean).join('-');
  const snapshots = path.join(fakeHome, '.claude', 'projects', `-${slug}`, 'memory', 'zenno', 'snapshots');
  fs.mkdirSync(snapshots, { recursive: true }); // present but no .git
  const pluginRoot = path.resolve(LIB_DIR, '..', '..', '..');
  const result = runDoctor(repo, pluginRoot, { HOME: fakeHome });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[FAIL\] memory repo health/);
  assert.match(result.stdout, /history lost/);
});

test('doctor WARNs when no memory snapshots dir exists for the repo', () => {
  const repo = makeTempRepo();
  writeValidConfig(repo);
  const pluginRoot = path.resolve(LIB_DIR, '..', '..', '..');
  const result = runDoctor(repo, pluginRoot, { HOME: makeTempRepo() });
  assert.match(result.stdout, /\[WARN\] memory repo health/);
  assert.match(result.stdout, /no memory directory configured/);
});

test('trap sanity check: provisioned repo with .env allowed still blocks everything else', () => {
  // Proves the trap test below fails for the hook behavior, not the wiring:
  // same hooks.json as the real repo (so all files exist), and the guard's
  // own escape hatch (allowPatterns) used for the .env fixture read — the
  // guard must block everything NOT explicitly allowed, so an allowlist of
  // exactly the fixture path keeps this green while any regression in the
  // deny logic still fails it.
  const { repo, fakeHome } = provisionedRepo();
  fs.writeFileSync(path.join(repo, '.env'), 'DOCTOR_FIXTURE=1\n');
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({
      version: 1,
      shield: { confidentialFileGuard: { denyPatterns: ['.env'], allowPatterns: [path.join(repo, '.env')] } },
      agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 },
      telemetry: { enabled: false, recordContent: false },
      traces: { defaultMode: 'raw', targetDir: 'zenno/traces' },
    })
  );
  const pluginRoot = path.resolve(LIB_DIR, '..', '..', '..');
  const result = runDoctor(repo, pluginRoot, { HOME: fakeHome });
  assert.equal(result.status, 0, `stderr was:\n${result.stderr}\nstdout was:\n${result.stdout}`);
});

test('sanity check actually runs the hooks: swapped guard outputs FAIL naming the hook', () => {
  // Copy the real repo's lib into a temp plugin dir, then replace the
  // secret-scanner hook with a copy of the confidential-file-guard logic
  // that exits 0 on everything (wrong behavior for the scanner) — the
  // doctor must FAIL the secret-scanner sanity, not pass it.
  const pluginRoot = makeTempRepo();
  const srcLib = path.resolve(LIB_DIR);
  const dstLib = path.join(pluginRoot, 'core', 'hooks', 'lib');
  fs.cpSync(srcLib, dstLib, { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, 'core', 'hooks'), { recursive: true });
  fs.cpSync(
    path.resolve(LIB_DIR, '..', 'hooks.json'),
    path.join(pluginRoot, 'core', 'hooks', 'hooks.json')
  );
  const hooked = fs.readFileSync(path.join(dstLib, 'secret-scanner-hook.js'), 'utf8');
  fs.writeFileSync(path.join(dstLib, 'secret-scanner-hook.js.bak'), hooked);
  // Replace with a no-op that always passes: behavior differs from the real
  // hook, which blocks the should-block payload → doctor must notice.
  fs.writeFileSync(path.join(dstLib, 'secret-scanner-hook.js'), '#!/usr/bin/env node\nprocess.exit(0);\n');

  const repo = makeTempRepo();
  writeValidConfig(repo);
  const result = runDoctor(repo, pluginRoot);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[FAIL\] hook sanity: secret-scanner/);
});

test('strictly read-only: running the doctor does not create or modify repo files', () => {
  const repo = makeTempRepo();
  writeValidConfig(repo);
  const before = fs.readdirSync(repo).sort();
  const configBefore = fs.readFileSync(path.join(repo, 'zenno', 'config.json'), 'utf8');
  const pluginRoot = path.resolve(LIB_DIR, '..', '..', '..');
  runDoctor(repo, pluginRoot);
  assert.deepEqual(fs.readdirSync(repo).sort(), before);
  assert.equal(fs.readFileSync(path.join(repo, 'zenno', 'config.json'), 'utf8'), configBefore);
});

test('summary line counts match the [OK]/[WARN]/[FAIL] lines', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true }); // no config → one WARN expected
  const pluginRoot = path.resolve(LIB_DIR, '..', '..', '..');
  const result = runDoctor(repo, pluginRoot);
  const ok = (result.stdout.match(/\[OK  \]/g) || []).length;
  const warn = (result.stdout.match(/\[WARN\]/g) || []).length;
  const fail = (result.stdout.match(/\[FAIL\]/g) || []).length;
  const m = result.stdout.match(/doctor: (\d+) checks — (\d+) OK, (\d+) WARN, (\d+) FAIL/);
  assert.ok(m, `no summary line in:\n${result.stdout}`);
  assert.equal(Number(m[1]), ok + warn + fail);
  assert.equal(Number(m[2]), ok);
  assert.equal(Number(m[3]), warn);
  assert.equal(Number(m[4]), fail);
});

test('a fixture hooks.json entry pointing at a missing file → [FAIL] hook file missing', () => {
  const pluginRoot = makeTempRepo();
  const srcLib = path.resolve(LIB_DIR);
  const dstLib = path.join(pluginRoot, 'core', 'hooks', 'lib');
  fs.cpSync(srcLib, dstLib, { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, 'core', 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginRoot, 'core', 'hooks', 'hooks.json'),
    JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/core/hooks/lib/does-not-exist.js"' }] }],
      },
    })
  );
  const repo = makeTempRepo();
  writeValidConfig(repo);
  const result = runDoctor(repo, pluginRoot);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[FAIL\].*hook file missing/);
});
