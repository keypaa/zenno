const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { getCandidatePaths, formatBlockMessage } = require('./confidential-file-guard-hook');

test('getCandidatePaths extracts the file_path from a Read tool call', () => {
  const paths = getCandidatePaths({
    tool_name: 'Read',
    tool_input: { file_path: '.env' },
  });
  assert.deepEqual(paths, ['.env']);
});

test('getCandidatePaths extracts paths from a Bash tool call', () => {
  const paths = getCandidatePaths({
    tool_name: 'Bash',
    tool_input: { command: 'cat .env' },
  });
  assert.deepEqual(paths, ['.env']);
});

test('getCandidatePaths returns empty for an unrelated tool', () => {
  const paths = getCandidatePaths({ tool_name: 'Write', tool_input: {} });
  assert.deepEqual(paths, []);
});

test('formatBlockMessage names the blocked path and explains the override path', () => {
  const message = formatBlockMessage('.env');
  assert.match(message, /\.env/);
  assert.match(message, /zenno\/config\.json/);
});

// --- Real subprocess tests: actual exit-code contract against a real repo.

function makeTempRepoWithConfig() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-guard-e2e-test-'));
  fs.mkdirSync(path.join(repo, 'zenno'));
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({
      shield: {
        confidentialFileGuard: {
          denyPatterns: ['.env', '.env.*', '*.pem'],
          allowPatterns: ['.env.example'],
        },
      },
    })
  );
  return repo;
}

function runHook(payload) {
  const hookPath = path.join(__dirname, 'confidential-file-guard-hook.js');
  return spawnSync('node', [hookPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

test('exits 2 blocking a direct Read of .env', () => {
  const repo = makeTempRepoWithConfig();

  const result = runHook({
    tool_name: 'Read',
    tool_input: { file_path: '.env' },
    cwd: repo,
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Confidential File Guard: blocked/);
});

test('exits 2 blocking an indirect Bash cat of .env', () => {
  const repo = makeTempRepoWithConfig();

  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'cat .env' },
    cwd: repo,
  });

  assert.equal(result.status, 2);
});

test('exits 0 allowing a Read of .env.example — allow pattern wins', () => {
  const repo = makeTempRepoWithConfig();

  const result = runHook({
    tool_name: 'Read',
    tool_input: { file_path: '.env.example' },
    cwd: repo,
  });

  assert.equal(result.status, 0);
});

test('exits 0 allowing a Read of an unrelated file', () => {
  const repo = makeTempRepoWithConfig();

  const result = runHook({
    tool_name: 'Read',
    tool_input: { file_path: 'README.md' },
    cwd: repo,
  });

  assert.equal(result.status, 0);
});

test('exits 0 immediately for a Bash command with no sensitive-file read', () => {
  const repo = makeTempRepoWithConfig();

  const result = runHook({
    tool_name: 'Bash',
    tool_input: { command: 'npm install' },
    cwd: repo,
  });

  assert.equal(result.status, 0);
});
