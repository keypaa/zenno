const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runConfigImport, formatChangesReport } = require('./config-import-cli');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-configimport-test-'));
}

function writeCurrentConfig(repo, config) {
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'zenno', 'config.json'), JSON.stringify(config));
}

function writeSourceFile(repo, config) {
  const p = path.join(repo, 'import-source.json');
  fs.writeFileSync(p, JSON.stringify(config));
  return p;
}

const BASE_CONFIG = {
  version: 1,
  shield: { confidentialFileGuard: { denyPatterns: ['.env'], allowPatterns: [] } },
  agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 },
  telemetry: { enabled: false, recordContent: false },
  traces: { defaultMode: 'raw' },
};

test('fails cleanly when the source file does not exist', () => {
  const repo = makeTempRepo();
  const result = runConfigImport(repo, path.join(repo, 'nonexistent.json'));
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'source-not-found');
});

test('fails cleanly on invalid JSON in the source file', () => {
  const repo = makeTempRepo();
  const sourcePath = path.join(repo, 'bad.json');
  fs.writeFileSync(sourcePath, '{ not valid json');
  const result = runConfigImport(repo, sourcePath);
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'invalid-json');
});

test('fails cleanly when the source config fails schema validation', () => {
  const repo = makeTempRepo();
  const sourcePath = writeSourceFile(repo, { version: 1 }); // missing required keys
  const result = runConfigImport(repo, sourcePath);
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'invalid-schema');
});

test('applies immediately when there are no security-relevant changes', () => {
  const repo = makeTempRepo();
  writeCurrentConfig(repo, BASE_CONFIG);
  const imported = { ...BASE_CONFIG, traces: { defaultMode: 'curated' } };
  const sourcePath = writeSourceFile(repo, imported);

  const result = runConfigImport(repo, sourcePath);

  assert.equal(result.applied, true);
  const written = JSON.parse(fs.readFileSync(path.join(repo, 'zenno', 'config.json'), 'utf8'));
  assert.equal(written.traces.defaultMode, 'curated');
});

test('refuses to apply security-relevant changes without --confirm', () => {
  const repo = makeTempRepo();
  writeCurrentConfig(repo, BASE_CONFIG);
  const imported = { ...BASE_CONFIG, agentTeam: { ...BASE_CONFIG.agentTeam, depthCap: 10 } };
  const sourcePath = writeSourceFile(repo, imported);

  const result = runConfigImport(repo, sourcePath);

  assert.equal(result.applied, false);
  assert.equal(result.reason, 'security-relevant-changes-need-confirmation');
  assert.equal(result.securityRelevant.length, 1);

  // Confirm the file on disk was NOT modified.
  const stillCurrent = JSON.parse(fs.readFileSync(path.join(repo, 'zenno', 'config.json'), 'utf8'));
  assert.equal(stillCurrent.agentTeam.depthCap, 3);
});

test('applies security-relevant changes when --confirm is passed', () => {
  const repo = makeTempRepo();
  writeCurrentConfig(repo, BASE_CONFIG);
  const imported = { ...BASE_CONFIG, agentTeam: { ...BASE_CONFIG.agentTeam, depthCap: 10 } };
  const sourcePath = writeSourceFile(repo, imported);

  const result = runConfigImport(repo, sourcePath, { confirm: true });

  assert.equal(result.applied, true);
  const written = JSON.parse(fs.readFileSync(path.join(repo, 'zenno', 'config.json'), 'utf8'));
  assert.equal(written.agentTeam.depthCap, 10);
});

test('formatChangesReport lists security-relevant changes separately from general ones', () => {
  const report = formatChangesReport({
    securityRelevant: [{ path: 'agentTeam.depthCap', oldValue: 3, newValue: 10 }],
    general: [{ path: 'traces.defaultMode', oldValue: 'raw', newValue: 'curated' }],
  });
  assert.match(report, /Security-relevant changes/);
  assert.match(report, /agentTeam\.depthCap/);
  assert.match(report, /Other changes/);
});

// --- Real subprocess tests

test('end-to-end: CLI exits 1 and prints changes when confirmation is needed', () => {
  const repo = makeTempRepo();
  writeCurrentConfig(repo, BASE_CONFIG);
  const imported = { ...BASE_CONFIG, agentTeam: { ...BASE_CONFIG.agentTeam, depthCap: 10 } };
  const sourcePath = writeSourceFile(repo, imported);
  const cliPath = path.join(__dirname, 'config-import-cli.js');

  const result = spawnSync('node', [cliPath, sourcePath], { cwd: repo, encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Security-relevant changes/);
  assert.match(result.stdout, /Re-run with --confirm/);
});

test('end-to-end: CLI exits 0 and applies with --confirm', () => {
  const repo = makeTempRepo();
  writeCurrentConfig(repo, BASE_CONFIG);
  const imported = { ...BASE_CONFIG, agentTeam: { ...BASE_CONFIG.agentTeam, depthCap: 10 } };
  const sourcePath = writeSourceFile(repo, imported);
  const cliPath = path.join(__dirname, 'config-import-cli.js');

  const result = spawnSync('node', [cliPath, sourcePath, '--confirm'], { cwd: repo, encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /imported successfully/);
});
