const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { classifySelfModTarget } = require('./classify-self-mod-target');

function makeFakePluginAndTarget() {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-plugin-root-'));
  const targetRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-target-repo-'));
  return { pluginRoot, targetRepoRoot };
}

test('classifies hooks.json as security-critical', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = classifySelfModTarget(
    path.join(pluginRoot, 'core', 'hooks', 'hooks.json'),
    pluginRoot,
    targetRepoRoot
  );
  assert.equal(result, 'security-critical');
});

test('classifies plugin.json as security-critical', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = classifySelfModTarget(
    path.join(pluginRoot, '.claude-plugin', 'plugin.json'),
    pluginRoot,
    targetRepoRoot
  );
  assert.equal(result, 'security-critical');
});

test('classifies any guard implementation .js file under core/hooks/ as security-critical', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = classifySelfModTarget(
    path.join(pluginRoot, 'core', 'hooks', 'lib', 'secret-scanner-hook.js'),
    pluginRoot,
    targetRepoRoot
  );
  assert.equal(result, 'security-critical');
});

test('classifies a skill file as general content, not security-critical', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = classifySelfModTarget(
    path.join(pluginRoot, 'core', 'skills', 'using-the-repo-graph', 'SKILL.md'),
    pluginRoot,
    targetRepoRoot
  );
  assert.equal(result, 'general');
});

test('classifies the target repo\'s zenno/config.json as security-critical', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = classifySelfModTarget(
    path.join(targetRepoRoot, 'zenno', 'config.json'),
    pluginRoot,
    targetRepoRoot
  );
  assert.equal(result, 'security-critical');
});

test('classifies an unrelated file in the target repo as not-applicable', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = classifySelfModTarget(
    path.join(targetRepoRoot, 'src', 'index.js'),
    pluginRoot,
    targetRepoRoot
  );
  assert.equal(result, 'not-applicable');
});

test('classifies zenno/plans/ content in the target repo as not-applicable (not config.json itself)', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = classifySelfModTarget(
    path.join(targetRepoRoot, 'zenno', 'plans', '2026-07-11-foundation.md'),
    pluginRoot,
    targetRepoRoot
  );
  assert.equal(result, 'not-applicable');
});

test('correctly classifies zenno/config.json as security-critical even when pluginRoot === targetRepoRoot', () => {
  // The exact situation of developing Zenno itself: working directly
  // inside the plugin's own repo, where the two roots are the same
  // directory.
  const sameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-samedir-'));
  const result = classifySelfModTarget(
    path.join(sameDir, 'zenno', 'config.json'),
    sameDir,
    sameDir
  );
  assert.equal(result, 'security-critical');
});

test('classification is case-insensitive, matching Windows/macOS default filesystem behavior', () => {
  const { pluginRoot, targetRepoRoot } = makeFakePluginAndTarget();
  const result = classifySelfModTarget(
    path.join(pluginRoot, 'Core', 'Hooks', 'Hooks.JSON'),
    pluginRoot,
    targetRepoRoot
  );
  assert.equal(result, 'security-critical');
});
