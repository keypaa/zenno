const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// RED phase: this module doesn't exist yet
const { handlePermissionAsk } = require('./permission');

function tmpRepo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-opencode-perm-'));
  fs.mkdirSync(path.join(d, 'zenno'), { recursive: true });
  fs.writeFileSync(path.join(d, 'zenno', 'config.json'), JSON.stringify({
    version: 1,
    shield: {
      confidentialFileGuard: { denyPatterns: ['.env', '*.pem'], allowPatterns: ['.env.example'] },
      provenanceGuard: { blockGlobalInstalls: true },
      secretScanner: { allowlist: [] }
    },
    agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 },
    telemetry: { enabled: false }, traces: { defaultMode: 'raw' }
  }));
  return d;
}

const PLUGIN_ROOT = path.resolve(__dirname, '../..');

test('confidential guard blocks Read .env', async () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.env'), 'SECRET=1');
  const perm = { type: 'read', pattern: path.join(repo, '.env'), metadata: { file_path: path.join(repo, '.env'), cwd: repo }, title: 'Read' };
  const out = {};
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  assert.equal(out.status, 'deny');
  assert.match(out.reason, /Confidential File Guard/);
});

test('confidential guard allows .env.example via allowlist', async () => {
  const repo = tmpRepo();
  const p = path.join(repo, '.env.example');
  fs.writeFileSync(p, 'EXAMPLE=1');
  const perm = { type: 'read', pattern: p, metadata: { file_path: p, cwd: repo }, title: 'Read' };
  const out = {};
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  assert.equal(out.status, 'allow');
});

test('provenance guard blocks global install', async () => {
  const repo = tmpRepo();
  const perm = { type: 'bash', pattern: 'npm install -g left-pad', metadata: { command: 'npm install -g left-pad', cwd: repo }, title: 'Bash' };
  const out = {};
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  assert.equal(out.status, 'deny');
  assert.match(out.reason, /Provenance Guard/);
});

test('provenance guard blocks typosquat', async () => {
  const repo = tmpRepo();
  // "expres" is distance 1 from "express" (4-char threshold)
  const perm = { type: 'bash', pattern: 'npm install expres', metadata: { command: 'npm install expres', cwd: repo }, title: 'Bash' };
  const out = {};
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  assert.equal(out.status, 'deny');
});

test('haruspex guard blocks write to core/hooks/hooks.json', async () => {
  const repo = tmpRepo();
  const target = path.join(PLUGIN_ROOT, 'core/hooks/hooks.json');
  const perm = { type: 'write', pattern: target, metadata: { file_path: target, cwd: repo }, title: 'Write' };
  const out = {};
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  assert.equal(out.status, 'deny');
  assert.match(out.reason, /Haruspex Guard/);
});

test('haruspex respects ZENNO_ALLOW_SELF_MOD=1', async () => {
  const repo = tmpRepo();
  const target = path.join(PLUGIN_ROOT, 'core/hooks/hooks.json');
  const perm = { type: 'write', pattern: target, metadata: { file_path: target, cwd: repo }, title: 'Write' };
  const out = {};
  const prev = process.env.ZENNO_ALLOW_SELF_MOD;
  process.env.ZENNO_ALLOW_SELF_MOD = '1';
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  if (prev === undefined) delete process.env.ZENNO_ALLOW_SELF_MOD; else process.env.ZENNO_ALLOW_SELF_MOD = prev;
  assert.equal(out.status, 'allow');
});

test('secret scanner blocks git commit with staged secret', async () => {
  const repo = tmpRepo();
  // init git, stage file with secret
  const { execSync } = require('node:child_process');
  execSync('git init -q', { cwd: repo });
  execSync('git config user.email "t@t.t"', { cwd: repo });
  execSync('git config user.name "t"', { cwd: repo });
  fs.writeFileSync(path.join(repo, 'secret.txt'), 'AKIAIOSFODNN7EXAMPLE\n');
  execSync('git add secret.txt', { cwd: repo });
  const perm = { type: 'bash', pattern: 'git commit -m "x"', metadata: { command: 'git commit -m "x"', cwd: repo }, title: 'Bash' };
  const out = {};
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  assert.equal(out.status, 'deny');
  assert.match(out.reason, /Secret Scanner/);
});

test('agent cap blocks when total cap exceeded', async () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, 'zenno', '.agent-team-state.json'), JSON.stringify({ totalSpawned: 10, currentActive: 0, depthByAgentId: {}, pendingDepthStack: [] }));
  const perm = { type: 'agent', pattern: 'agent', metadata: { cwd: repo }, title: 'Agent' };
  const out = {};
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  assert.equal(out.status, 'deny');
  assert.match(out.reason, /Agent Team cap/);
});

test('benign bash echo is allowed', async () => {
  const repo = tmpRepo();
  const perm = { type: 'bash', pattern: 'echo hello', metadata: { command: 'echo hello', cwd: repo }, title: 'Bash' };
  const out = {};
  await handlePermissionAsk(perm, out, { projectDir: repo, pluginRoot: PLUGIN_ROOT });
  assert.equal(out.status, 'allow');
});
