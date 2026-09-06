const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { getCandidatePaths, formatBlockMessage } = require('./haruspex-guard-hook');

test('getCandidatePaths resolves a relative Write file_path against cwd', () => {
  const paths = getCandidatePaths(
    { tool_name: 'Write', tool_input: { file_path: 'core/hooks/hooks.json' } },
    '/fake/plugin/root'
  );
  assert.deepEqual(paths, [path.resolve('/fake/plugin/root', 'core/hooks/hooks.json')]);
});

test('getCandidatePaths extracts write targets from a Bash command', () => {
  const paths = getCandidatePaths(
    { tool_name: 'Bash', tool_input: { command: 'rm hooks.json' } },
    '/fake/root'
  );
  assert.deepEqual(paths, [path.resolve('/fake/root', 'hooks.json')]);
});

test('getCandidatePaths returns empty for an unrelated tool', () => {
  const paths = getCandidatePaths({ tool_name: 'Read', tool_input: {} }, '/fake/root');
  assert.deepEqual(paths, []);
});

test('formatBlockMessage names the blocked path and the override mechanism', () => {
  const message = formatBlockMessage('/plugin/core/hooks/hooks.json');
  assert.match(message, /hooks\.json/);
  assert.match(message, /ZENNO_ALLOW_SELF_MOD/);
});

// --- Real subprocess tests: actual exit-code contract, real fake plugin
// root and target repo directories.

function makeFakePluginAndTarget() {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-haruspex-plugin-'));
  fs.mkdirSync(path.join(pluginRoot, 'core', 'hooks', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, 'core', 'skills'), { recursive: true });
  const targetRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-haruspex-target-'));
  return { pluginRoot, targetRepoRoot };
}

function runHook(pluginRoot, payload, extraEnv = {}) {
  const hookPath = path.join(__dirname, 'haruspex-guard-hook.js');
  return spawnSync('node', [hookPath, pluginRoot], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

test('exits 2 blocking a Write to hooks.json', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = runHook(pluginRoot, {
    tool_name: 'Write',
    tool_input: { file_path: path.join(pluginRoot, 'core', 'hooks', 'hooks.json') },
    cwd: targetRepoRoot,
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Haruspex Guard: blocked/);
});

test('exits 0 when ZENNO_ALLOW_SELF_MOD=1 override is active', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = runHook(
    pluginRoot,
    {
      tool_name: 'Write',
      tool_input: { file_path: path.join(pluginRoot, 'core', 'hooks', 'hooks.json') },
      cwd: targetRepoRoot,
    },
    { ZENNO_ALLOW_SELF_MOD: '1' }
  );

  assert.equal(result.status, 0);
});

test('exits 2 blocking a Bash rm targeting a guard implementation file', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = runHook(pluginRoot, {
    tool_name: 'Bash',
    tool_input: { command: `rm ${path.join(pluginRoot, 'core', 'hooks', 'lib', 'secret-scanner-hook.js')}` },
    cwd: targetRepoRoot,
  });

  assert.equal(result.status, 2);
});

test('exits 0 but logs when editing general plugin content (a skill file)', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = runHook(pluginRoot, {
    tool_name: 'Write',
    tool_input: { file_path: path.join(pluginRoot, 'core', 'skills', 'some-skill.md') },
    cwd: targetRepoRoot,
  });

  assert.equal(result.status, 0);
  assert.match(result.stderr, /note — modifying Zenno plugin content/);
  const journalPath = path.join(targetRepoRoot, 'zenno', 'audit', 'journal.jsonl');
  assert.ok(fs.existsSync(journalPath));
});

test('exits 2 blocking a write to the target repo\'s zenno/config.json', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = runHook(pluginRoot, {
    tool_name: 'Write',
    tool_input: { file_path: path.join(targetRepoRoot, 'zenno', 'config.json') },
    cwd: targetRepoRoot,
  });

  assert.equal(result.status, 2);
});

test('exits 0 silently for an unrelated file write', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = runHook(pluginRoot, {
    tool_name: 'Write',
    tool_input: { file_path: path.join(targetRepoRoot, 'src', 'index.js') },
    cwd: targetRepoRoot,
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});
