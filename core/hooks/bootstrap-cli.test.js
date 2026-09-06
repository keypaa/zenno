const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deriveProjectMemoryDir } = require('./bootstrap-cli');

test('deriveProjectMemoryDir produces a stable, filesystem-safe directory name', () => {
  const result = deriveProjectMemoryDir('/home/user/my-project', '/home/user');
  assert.equal(
    result,
    path.join('/home/user', '.claude', 'projects', '-home-user-my-project', 'memory')
  );
});

test('deriveProjectMemoryDir strips a Windows drive letter from the repo path before slugging', () => {
  const result = deriveProjectMemoryDir('C:\\Users\\pauma\\projects\\zenno', 'C:\\Users\\pauma');
  const projectSlugSegment = result.split(/[\\/]/).find((seg) => seg.startsWith('-'));

  assert.equal(projectSlugSegment, '-Users-pauma-projects-zenno');
  assert.doesNotMatch(projectSlugSegment, /C:/);
});

test('end-to-end: running the CLI as a real subprocess performs bootstrap', () => {
  const targetRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-cli-repo-'));
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-cli-home-'));
  const cliPath = path.join(__dirname, 'bootstrap-cli.js');

  execFileSync('node', [cliPath], {
    input: JSON.stringify({ cwd: targetRepoRoot }),
    env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
  });

  assert.ok(fs.existsSync(path.join(targetRepoRoot, 'zenno', '.initialized')));
  assert.ok(fs.existsSync(path.join(targetRepoRoot, 'zenno', 'config.json')));
});
