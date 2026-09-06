const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, 'cost-report-cli.js');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sessionLine({ model, usage, content }) {
  const message = { role: 'assistant', model, content };
  if (usage !== undefined) message.usage = usage;
  return JSON.stringify({ type: 'assistant', message });
}

function usage(input, output) {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
}

// Fixture project dir: fake HOME containing
// .claude/projects/-<slug>/fake-session.jsonl with 2 assistant messages.
function fixtureProjectHome(repo) {
  const fakeHome = makeTempDir('zenno-cost-cli-home-');
  const slug = repo.replace(/^[A-Za-z]:/, '').split(/[\\/]/).filter(Boolean).join('-');
  const projDir = path.join(fakeHome, '.claude', 'projects', `-${slug}`);
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(
    path.join(projDir, 'fake-session.jsonl'),
    [
      sessionLine({ model: 'model-a', usage: usage(3000, 800), content: [{ type: 'tool_use', id: 't1', name: 'Agent', input: {} }] }),
      sessionLine({ model: 'model-a', usage: usage(104, 92), content: [{ type: 'text', text: 'done' }] }),
    ].join('\n') + '\n',
    'utf8'
  );
  return fakeHome;
}

// Fixture repo: schema-valid config (caps 3/8/10), agent state
// totalSpawned 8, journal with one typosquat new-dependency.
function fixtureRepo() {
  const repo = makeTempDir('zenno-cost-cli-repo-');
  fs.mkdirSync(path.join(repo, 'zenno'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'zenno', 'config.json'),
    JSON.stringify({
      version: 1,
      shield: {},
      agentTeam: { depthCap: 3, concurrentCap: 8, totalPerTaskCap: 10 },
      telemetry: { enabled: false, recordContent: false },
      traces: { defaultMode: 'raw' },
    })
  );
  fs.writeFileSync(
    path.join(repo, 'zenno', '.agent-team-state.json'),
    JSON.stringify({ totalSpawned: 8, currentActive: 0, depthByAgentId: {}, pendingDepthStack: [] })
  );
  fs.mkdirSync(path.join(repo, 'zenno', 'audit'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'zenno', 'audit', 'journal.jsonl'),
    JSON.stringify({ timestamp: '2026-09-06T00:00:00.000Z', type: 'new-dependency', package: 'evil-pkg', ecosystem: 'npm', typosquatSuspected: true, veryRecentlyPublished: false }) + '\n',
    'utf8'
  );
  return repo;
}

function runCli(repo, fakeHome, args = []) {
  return spawnSync('node', [CLI, ...args], {
    cwd: repo,
    env: { ...process.env, HOME: fakeHome },
    encoding: 'utf8',
    timeout: 30000,
  });
}

function journalLines(repo) {
  const p = path.join(repo, 'zenno', 'audit', 'journal.jsonl');
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('default run exits 0 with summary paragraph, 8/10 and 80%', () => {
  const repo = fixtureRepo();
  const result = runCli(repo, fixtureProjectHome(repo));
  assert.equal(result.status, 0, `stderr was:\n${result.stderr}`);
  assert.match(result.stdout, /3,104 input \/ 892 output tokens/);
  assert.match(result.stdout, /8\/10/);
  assert.match(result.stdout, /80%/);
  assert.match(result.stdout, /provenance-guard/);
});

test('--json parses with agentTeam.proximity === 0.8', () => {
  const repo = fixtureRepo();
  const result = runCli(repo, fixtureProjectHome(repo), ['--json']);
  assert.equal(result.status, 0, `stderr was:\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.agentTeam.proximity, 0.8);
  assert.equal(report.agentTeam.spawned, 8);
  assert.equal(report.totals.inputTokens, 3104);
});

test('run appends exactly one cost-report line to the journal', () => {
  const repo = fixtureRepo();
  runCli(repo, fixtureProjectHome(repo));
  const entries = journalLines(repo);
  const reports = entries.filter((e) => e.type === 'cost-report');
  assert.equal(reports.length, 1);
  assert.equal(reports[0].agentTeamProximity, 0.8);
  assert.equal(typeof reports[0].timestamp, 'string');
});

test('second run appends a second cost-report line (reports are auditable, not deduped)', () => {
  const repo = fixtureRepo();
  const fakeHome = fixtureProjectHome(repo);
  runCli(repo, fakeHome);
  runCli(repo, fakeHome);
  const reports = journalLines(repo).filter((e) => e.type === 'cost-report');
  assert.equal(reports.length, 2);
});

test('--session missing exits 1 with no session transcripts', () => {
  const repo = fixtureRepo();
  const result = runCli(repo, fixtureProjectHome(repo), ['--session', 'does-not-exist']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no session transcripts/);
});

test('empty project dir exits 1, never a zero-cost report', () => {
  const repo = fixtureRepo();
  const fakeHome = makeTempDir('zenno-cost-cli-empty-home-');
  const slug = repo.replace(/^[A-Za-z]:/, '').split(/[\\/]/).filter(Boolean).join('-');
  fs.mkdirSync(path.join(fakeHome, '.claude', 'projects', `-${slug}`), { recursive: true });
  const result = runCli(repo, fakeHome);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no session transcripts/);
});

test('missing project dir entirely exits 1', () => {
  const repo = fixtureRepo();
  const result = runCli(repo, makeTempDir('zenno-cost-cli-nohome-'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no session transcripts/);
});

test('human report lists per-model and per-guard tables', () => {
  const repo = fixtureRepo();
  const result = runCli(repo, fixtureProjectHome(repo));
  assert.equal(result.status, 0, `stderr was:\n${result.stderr}`);
  assert.match(result.stdout, /model-a/);
  assert.match(result.stdout, /block/);
});

test('report on a repo with no journal still exits 0 (no guard data, not a failure)', () => {
  const repo = fixtureRepo();
  fs.unlinkSync(path.join(repo, 'zenno', 'audit', 'journal.jsonl'));
  const result = runCli(repo, fixtureProjectHome(repo));
  assert.equal(result.status, 0, `stderr was:\n${result.stderr}`);
  assert.match(result.stdout, /0 guard firings/);
});
