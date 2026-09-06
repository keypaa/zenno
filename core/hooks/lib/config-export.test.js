const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { exportConfig } = require('./config-export');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-configexport-test-'));
}

test('exports the current config.json content to the destination path', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), '{"version":1}');

  const destPath = path.join(repo, 'exported-config.json');
  const result = exportConfig(repo, destPath);

  assert.equal(result.exported, true);
  assert.equal(fs.readFileSync(destPath, 'utf8'), '{"version":1}');
});

test('returns exported: false when there is no config.json to export', () => {
  const repo = makeTempRepo();
  const result = exportConfig(repo, path.join(repo, 'out.json'));
  assert.equal(result.exported, false);
  assert.equal(result.reason, 'no-config-to-export');
});

// Regression: the transcript-recovered module exported only
// `exportConfig` with no require.main entrypoint, so the invocation the
// skill documents (`node config-export.js <path>`) exited 0 having done
// nothing. These run the real subprocess, which is the only way to catch
// a missing main().
test('end-to-end: CLI writes the export and exits 0', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), '{"version":1}');
  const cliPath = path.join(__dirname, 'config-export.js');

  const result = spawnSync('node', [cliPath, 'exported.json'], { cwd: repo, encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /config exported/);
  assert.equal(fs.readFileSync(path.join(repo, 'exported.json'), 'utf8'), '{"version":1}');
});

test('end-to-end: CLI exits 1 with a message when there is no config to export', () => {
  const repo = makeTempRepo();
  const cliPath = path.join(__dirname, 'config-export.js');

  const result = spawnSync('node', [cliPath, 'exported.json'], { cwd: repo, encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no-config-to-export/);
});
