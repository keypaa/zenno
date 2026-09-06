#!/usr/bin/env node
// Plan 12 (Doctor/Health): `zenno doctor` — pure observer + first-run
// reporter. Owns everything impure: process spawning, filesystem reads,
// output formatting, exit codes. The check* decision functions live in
// doctor-checks.js (pure, unit-tested there); this file wires the real world
// into them.
//
// Strictly read-only by default, never auto-fixes (design §12.3 — same
// report-and-flag principle as Config Import and memory rollback). The only
// writes anywhere in doctor code paths are test-owned temp fixtures.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Temp dirs must survive sandbox TMPDIR quirks: os.tmpdir() here can point
// at a per-run dir the child hooks cannot see the same way, so prefer an
// explicit, stable base with a safe fallback.
function doctorTempBase() {
  for (const candidate of [process.env.TMPDIR, os.tmpdir(), '/tmp']) {
    if (!candidate) continue;
    try {
      fs.accessSync(candidate, fs.constants.W_OK);
      return candidate;
    } catch {
      // not writable — try next
    }
  }
  return process.cwd();
}

function doctorMkdtemp(prefix) {
  return fs.mkdtempSync(path.join(doctorTempBase(), prefix));
}
const {
  checkInstallHealth,
  checkExternalTools,
  checkBrokenReferences,
  checkConfigConsistency,
  summarize,
  doctorExitCode,
} = require('./doctor-checks');
const { runHook } = require('./test-support/run-hook');

function resolveHookPath(rawCommand, pluginRoot) {
  const m = rawCommand.match(/([A-Za-z0-9_./${}-]+\.js)/);
  if (!m) return null;
  return m[1].split('${CLAUDE_PLUGIN_ROOT}').join(pluginRoot);
}

// Deterministic sanity payloads: one benign input (must exit 0 — a false
// positive that blocks ordinary work is exactly what this catches) and one
// should-block input (must exit 2 with human-readable stderr) per guard.
// pluginRoot/repoRoot are substituted by the caller so every path is
// absolute inside the fixture repo; payload.cwd and the spawned processes'
// cwd both point at the fixture, never the real repo (the benign Agent Team
// case writes zenno/.agent-team-state.json via writeAgentTeamState).
function buildSanityPayloads(pluginRoot, repoRoot) {
  return {
    secretScanner: {
      key: 'secret-scanner-hook.js',
      name: 'secret-scanner',
      benign: {
        tool_name: 'Bash',
        tool_input: { command: 'echo hello' },
        cwd: repoRoot,
      },
      blocking: {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "add key"' },
        // Staged diff containing a real AWS access-key shape (AKIA + 16
        // uppercase alphanumerics — CI fixture, not a secret):
        // classifyGitCommand sees `git commit`, getStagedDiff returns the
        // staged text, and findPatternMatches flags it high-confidence.
        // Top-level key: setupPayloadFixture reads the UNstripped payload
        // and stripFixtureKeys removes it before spawn — nesting it inside
        // tool_input would send it to the hook AND skip staging entirely.
        stagedDiffFixture: 'AKIAIOSFODNN7EXAMPLE',
        cwd: repoRoot,
      },
    },
    confidentialFileGuard: {
      key: 'confidential-file-guard-hook.js',
      name: 'confidential-file-guard',
      benign: {
        tool_name: 'Read',
        tool_input: { file_path: path.join(repoRoot, 'README.md') },
        cwd: repoRoot,
      },
      blocking: {
        tool_name: 'Read',
        tool_input: { file_path: path.join(repoRoot, '.env') },
        cwd: repoRoot,
      },
    },
    provenanceGuard: {
      key: 'provenance-guard-hook.js',
      name: 'provenance-guard',
      benign: {
        tool_name: 'Bash',
        tool_input: { command: "pip install 'requests==2.31.0'" },
        cwd: repoRoot,
      },
      blocking: {
        tool_name: 'Bash',
        tool_input: { command: 'npm install -g left-pad' },
        cwd: repoRoot,
      },
    },
    haruspexGuard: {
      key: 'haruspex-guard-hook.js',
      name: 'haruspex-guard',
      // Haruspex takes the plugin root as argv[2] (verified in
      // haruspex-guard-hook.js: no argv → fail-open exit 0). The sanity
      // runner resolves argv from the spec's argvTemplate with the real
      // pluginRoot — the template here is inert documentation of shape.
      argvTemplate: ['<PLUGIN_ROOT>'],
      benign: {
        tool_name: 'Write',
        tool_input: { file_path: path.join(repoRoot, 'README.md') },
        cwd: repoRoot,
      },
      blocking: {
        tool_name: 'Write',
        tool_input: { file_path: path.join(pluginRoot, 'core', 'hooks', 'hooks.json') },
        cwd: repoRoot,
      },
    },
    agentTeamCap: {
      key: 'agent-team-cap-hook.js',
      name: 'agent-team-cap',
      // cwd is the throwaway sandbox repo: the benign case's
      // writeAgentTeamState lands there (fresh sandbox → depth 1 ≤ 3 →
      // exit 0), and nothing real is ever touched or created.
      benign: { tool_name: 'Agent', agent_id: null, cwd: '<SANDBOX>' },
      blocking: null, // block case is set up per-repo by the caller (see runHookChecks)
    },
  };
}

function describeMismatch(which, expected, observed) {
  return `${which} payload: expected ${expected}, observed ${observed}`;
}

// A hook that reads VCS state (the secret scanner reads the staged diff)
// needs that state to exist in the fixture repo. Payloads can carry a
// declarative fixture describing what to set up before spawning:
//   stagedDiffFixture: text written to a file, staged with git, so
//     getStagedDiff returns it to the scanner.
// The doctor must be safe to run in ANY repo the user points it at —
// including one that is not a git repo, is mid-rebase, or has hooks that
// reject commits. All VCS-state fixtures therefore happen in a throwaway
// sandbox repo created fresh per run (mkdtemp), never in repoRoot itself.
// setupGitSandbox returns the sandbox path, shared by every fixture that
// needs staged VCS state this run.
function setupGitSandbox() {
  const dir = doctorMkdtemp('zenno-doctor-sandbox-');
  // -c flags pin down everything git would otherwise inherit from the
  // user's global config: an unborn-HEAD default branch that `git commit`
  // rejects, a commit template, signing, and any core.hooksPath.
  const git = (args, extra = {}) =>
    spawnSync(
      'git',
      [
        '-c', 'user.name=zenno-doctor',
        '-c', 'user.email=zenno-doctor@localhost',
        '-c', 'commit.gpgsign=false',
        '-c', 'core.hooksPath=/dev/null',
        ...args,
      ],
      { cwd: dir, timeout: 10000, ...extra }
    );
  const init = git(['init', '-q', '-b', 'sandbox']);
  if (init.status !== 0) {
    throw new Error(`doctor fixture setup failed: git init exited ${init.status}: ${(init.stderr || '').trim()}`);
  }
  const commit = git(['commit', '-q', '--allow-empty', '--no-gpg-sign', '--no-verify', '-m', 'sandbox root']);
  if (commit.status !== 0) {
    throw new Error(`doctor fixture setup failed: git commit exited ${commit.status}: ${(commit.stderr || '').trim()}`);
  }
  return dir;
}

function setupPayloadFixture(payload, sandboxDir) {
  if (payload.stagedDiffFixture !== undefined) {
    const p = path.join(sandboxDir, 'doctor-fixture-secret.txt');
    fs.writeFileSync(p, payload.stagedDiffFixture + '\n', 'utf8');
    const added = spawnSync('git', ['add', 'doctor-fixture-secret.txt'], { cwd: sandboxDir, timeout: 10000 });
    if (added.status !== 0) {
      throw new Error(`doctor fixture setup failed: git add exited ${added.status}: ${(added.stderr || '').trim()}`);
    }
  }
}

// Spawned hooks inherit this process's environment — including any
// GIT_* the harness sets (GIT_DIR, GIT_CONFIG_COUNT, ...), which would
// redirect the hook's OWN git calls away from payload-cwd. The scanner
// reads its diff via getStagedDiff(payload.cwd), so the env and the cwd
// must agree: scrub all GIT_* / GIT_DIR / GIT_WORK_TREE from the child's
// environment (verified: without this, the staged fixture is invisible
// and the should-block proof exits 0).
function scrubbedEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^GIT_/.test(k) || k === 'GIT_DIR' || k === 'GIT_WORK_TREE') delete env[k];
  }
  return env;
}

function runSingleSanity({ name, hookPath, argv, benign, blocking, sandboxDir }) {
  const checks = [];
  // Fixture setup MUST run against the unstripped payload: the staging
  // instruction lives in stagedDiffFixture, which the hook never sees.
  setupPayloadFixture(benign, sandboxDir);
  benign = stripFixtureKeys(benign);
  const benignResult = spawnSync('node', [hookPath, ...(argv || [])], {
    input: JSON.stringify(benign),
    encoding: 'utf8',
    timeout: 15000,
    cwd: benign.cwd || process.cwd(),
    env: scrubbedEnv(),
  });
  if (benignResult.status === 0) {
    checks.push({ name: `hook sanity: ${name} (benign)`, status: 'OK', detail: 'benign input passes' });
  } else {
    checks.push({
      name: `hook sanity: ${name} (benign)`,
      status: 'FAIL',
      detail: describeMismatch('benign', 'exit 0', `exit ${benignResult.status}`),
    });
    return checks;
  }
  if (blocking === null || blocking === undefined) {
    return checks;
  }
  setupPayloadFixture(blocking, sandboxDir);
  blocking = stripFixtureKeys(blocking);
  const blockingResult = spawnSync('node', [hookPath, ...(argv || [])], {
    input: JSON.stringify(blocking),
    encoding: 'utf8',
    timeout: 15000,
    cwd: blocking.cwd || process.cwd(),
    env: scrubbedEnv(),
  });
  if (blockingResult.status === 2 && (blockingResult.stderr || '').trim().length > 0) {
    checks.push({ name: `hook sanity: ${name} (should-block)`, status: 'OK', detail: 'blocking input blocked with message' });
  } else {
    checks.push({
      name: `hook sanity: ${name} (should-block)`,
      status: 'FAIL',
      detail: describeMismatch('should-block', 'exit 2 with stderr', `exit ${blockingResult.status}`),
    });
  }
  return checks;
}

// Fixture-only keys (stagedDiffFixture) never reach the hook process —
// they describe setup the doctor performs, not tool input.
function stripFixtureKeys(payload) {
  const copy = { ...payload };
  delete copy.stagedDiffFixture;
  return copy;
}

// Registration: every command line in hooks.json resolves to a file.
// Sanity: the five guard hooks are run against their payload pairs.
// The Agent Team block case needs a config with depthCap 0 in the repo —
// callers that cannot provide one pass skipAgentTeamBlock=true.
function runHookChecks(hooksJson, pluginRoot, repoRoot, payloads, options = {}) {
  const checks = [];
  const sandboxDir = setupGitSandbox();
  for (const [event, groups] of Object.entries(hooksJson.hooks || {})) {
    for (const group of groups) {
      for (const hook of group.hooks || []) {
        const hookPath = resolveHookPath(hook.command || '', pluginRoot);
        if (!hookPath) continue;
        const shortName = path.basename(hookPath);
        if (!fs.existsSync(hookPath)) {
          checks.push({
            name: `hook registration: ${event}/${hook.matcher || '*'} → ${shortName}`,
            status: 'FAIL',
            detail: `hook file missing: ${hookPath}`,
            fix: `restore ${shortName} from the zenno source, or remove the entry from core/hooks/hooks.json`,
          });
          continue;
        }
        checks.push({
          name: `hook registration: ${event}/${hook.matcher || '*'} → ${shortName}`,
          status: 'OK',
          detail: 'registered file exists',
        });
      }
    }
  }

  for (const spec of Object.values(payloads)) {
    const hookPath = path.join(pluginRoot, 'core', 'hooks', 'lib', spec.key);
    if (!fs.existsSync(hookPath)) {
      checks.push({
        name: `hook sanity: ${spec.name}`,
        status: 'FAIL',
        detail: `hook file missing: ${hookPath}`,
      });
      continue;
    }
    // Haruspex is the one hook whose plugin root arrives via argv, not the
    // payload (hooks.json passes "${CLAUDE_PLUGIN_ROOT}" on the command
    // line) — mirror that here, or it fail-opens to exit 0 by design.
    const argv = spec.name === 'haruspex-guard' ? [pluginRoot] : [];
    if (spec.name === 'agent-team-cap' && options.skipAgentTeamBlock) {
      checks.push(...runSingleSanity({ name: spec.name, hookPath, argv, benign: spec.benign, blocking: null, sandboxDir }));
      continue;
    }
    if (spec.name === 'agent-team-cap') {
      // The agent-team hook READS caps from payload-cwd's config and WRITES
      // state there, so benign and blocking need different cwds — both
      // inside throwaway sandbox copies, never the user's repo. The git
      // sandbox (shared fixture for the scanner) doubles as the benign
      // sandbox (fresh dir → default state, depth 1 ≤ 3 → exit 0). The block
      // case gets a second sandbox pre-seeded with depthCap 0 in its
      // zenno/config.json (pure-local rule — no network involved).
      const benign = { ...stripFixtureKeys(spec.benign), cwd: sandboxDir };
      const blockSandbox = doctorMkdtemp('zenno-doctor-block-');
      fs.mkdirSync(path.join(blockSandbox, 'zenno'), { recursive: true });
      fs.writeFileSync(
        path.join(blockSandbox, 'zenno', 'config.json'),
        JSON.stringify({
          version: 1,
          shield: {},
          agentTeam: { depthCap: 0, concurrentCap: 8, totalPerTaskCap: 10 },
          telemetry: { enabled: false, recordContent: false },
          traces: { defaultMode: 'raw' },
        })
      );
      const blocking = { tool_name: 'Agent', agent_id: null, cwd: blockSandbox };
      checks.push(...runSingleSanity({ name: spec.name, hookPath, argv, benign, blocking, sandboxDir }));
      continue;
    }
    if (spec.name === 'secret-scanner') {
      // The scanner's should-block proof must see staged VCS state, so that
      // payload runs with cwd pointed at the sandbox repo — but ONLY that
      // payload: the benign one keeps the fixture repoRoot as its cwd, so
      // the benign case proves nothing about sandbox state, only that an
      // ordinary command is not a commit/push-shaped input.
      // NOTE: do NOT strip stagedDiffFixture here — runSingleSanity stages it
      // (fixture setup reads the UNstripped payload) and strips it before
      // spawn. Stripping here is what silently dropped the staging step.
      const blocking =
        spec.blocking === null || spec.blocking === undefined
          ? spec.blocking
          : { ...spec.blocking, cwd: sandboxDir };
      checks.push(...runSingleSanity({ name: spec.name, hookPath, argv, benign: spec.benign, blocking, sandboxDir }));
      continue;
    }
    checks.push(...runSingleSanity({ name: spec.name, hookPath, argv, benign: spec.benign, blocking: spec.blocking, sandboxDir }));
  }
  return checks;
}

// --- world wiring ----------------------------------------------------------

function readJsonFile(p) {
  try {
    return { value: JSON.parse(fs.readFileSync(p, 'utf8')), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
}

function deriveMemoryDir(repoRoot) {
  const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const slug = repoRoot
    .replace(/^[A-Za-z]:/, '')
    .split(/[\\/]/)
    .filter(Boolean)
    .join('-');
  return path.join(homeDir, '.claude', 'projects', `-${slug}`, 'memory');
}

function readMemoryState(repoRoot) {
  const memoryDir = deriveMemoryDir(repoRoot);
  const snapshotsPath = path.join(memoryDir, 'zenno', 'snapshots');
  if (!fs.existsSync(snapshotsPath)) {
    return null;
  }
  const gitDir = path.join(snapshotsPath, '.git');
  const gitDirExists = fs.existsSync(gitDir);
  let gitOk = false;
  if (gitDirExists) {
    gitOk =
      spawnSync('git', ['-C', snapshotsPath, 'status', '--porcelain'], { encoding: 'utf8', timeout: 10000 }).status === 0;
  }
  return { snapshotsPath, rootExists: true, gitDirExists, gitOk };
}

function readWorld(pluginRoot, repoRoot) {
  const markerPath = path.join(repoRoot, 'zenno', '.initialized');
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  const hooksPath = path.join(pluginRoot, 'core', 'hooks', 'hooks.json');

  const marker = fs.existsSync(markerPath) ? readJsonFile(markerPath).value : null;
  const configRead = fs.existsSync(configPath) ? readJsonFile(configPath) : { value: null, error: null };

  // Memory snapshots live OUTSIDE the repo: <memoryDir>/zenno/snapshots
  // with its own private .git (init-memory-repo.js). memoryDir is derived
  // from the repo path exactly like bootstrap-cli.js does
  // (~/.claude/projects/-<slug>/memory). Absent dir → null (no memory
  // configured for this repo — not an error, checkMemoryRepo WARNs).
  const memory = readMemoryState(repoRoot);

  const toolStatus = (name) => spawnSync('which', [name], { encoding: 'utf8', timeout: 5000 }).status === 0;
  const tools = { rg: toolStatus('rg'), ctags: toolStatus('ctags') };

  const hooksJson = fs.existsSync(hooksPath) ? readJsonFile(hooksPath).value : { hooks: {} };

  return { marker, config: configRead.value, configErrors: configRead.error, memory, tools, hooksJson };
}

function formatCheck(c) {
  const tag = c.status === 'OK' ? '[OK  ]' : c.status === 'WARN' ? '[WARN]' : '[FAIL]';
  const lines = [`${tag} ${c.name} — ${c.detail}`];
  if (c.status !== 'OK' && c.fix) {
    lines.push(`       fix: ${c.fix}`);
  }
  return lines.join('\n');
}

function runDoctor(pluginRoot, repoRoot, options = {}) {
  const world = readWorld(pluginRoot, repoRoot);
  const all = [
    ...checkInstallHealth({ marker: world.marker, config: world.config, configErrors: world.configErrors, memory: world.memory }),
    ...checkExternalTools({ tools: world.tools }),
    ...checkBrokenReferences({
      config: world.config,
      repoRoot,
      pathExists: (p) => fs.existsSync(p),
    }),
    ...checkConfigConsistency({ config: world.config }),
    ...runHookChecks(world.hooksJson, pluginRoot, repoRoot, buildSanityPayloads(pluginRoot, repoRoot), options),
  ];
  const summary = summarize(all);
  const lines = all.map(formatCheck);
  lines.push(`doctor: ${summary.total} checks — ${summary.ok} OK, ${summary.warn} WARN, ${summary.fail} FAIL`);
  return { output: lines.join('\n'), exitCode: doctorExitCode(summary) };
}

function main() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..', '..', '..');
  const repoRoot = process.cwd();
  const { output, exitCode } = runDoctor(pluginRoot, repoRoot);
  process.stdout.write(output + '\n');
  process.exitCode = exitCode;
}

if (require.main === module) {
  main();
}

module.exports = { runDoctor, runHookChecks, buildSanityPayloads, resolveHookPath, formatCheck };
