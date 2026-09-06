const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
