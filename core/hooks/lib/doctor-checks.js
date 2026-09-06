// Plan 12 (Doctor/Health): pure check functions. Each check receives
// injected state and performs no I/O — the CLI (doctor-cli.js) wires in the
// real world. This keeps every branch unit-testable without fixtures.
const path = require('node:path');
const { validateConfigSchema } = require('./config-schema');

const OK = 'OK';
const WARN = 'WARN';
const FAIL = 'FAIL';

function result(name, status, detail, fix) {
  const r = { name, status, detail };
  if (fix) r.fix = fix;
  return r;
}

// --- 1. Installation health ---------------------------------------------

function checkBootstrapMarker(marker) {
  if (!marker || marker.scaffolded !== true) {
    return result(
      'bootstrap marker',
      WARN,
      'zenno/.bootstrap.json is missing or has no scaffolded:true — bootstrap may not have run to completion'
    );
  }
  return result('bootstrap marker', OK, 'bootstrap completed (scaffolded:true)');
}

function checkConfigValidity(config, configErrors) {
  if (config === null || config === undefined) {
    if (configErrors) {
      return result('config.json validity', FAIL, `zenno/config.json is unparseable: ${configErrors}`);
    }
    return result(
      'config.json validity',
      WARN,
      'no config yet — bootstrap will seed it on next session start (write-config owns first-write)'
    );
  }
  const schema = validateConfigSchema(config);
  if (!schema.valid) {
    return result(
      'config.json validity',
      FAIL,
      `schema validation failed: ${schema.errors.join('; ')}`,
      'fix the config, then validate + apply it with: node <plugin-root>/core/hooks/lib/config-import-cli.js <fixed-file> --confirm'
    );
  }
  return result('config.json validity', OK, 'parses and satisfies the config schema');
}

function checkMemoryRepo(memory) {
  if (!memory) {
    return result(
      'memory repo health',
      WARN,
      'memory repo not initialized — run zenno-memory-init (see the using-zenno-memory skill)'
    );
  }
  if (memory.rootExists && !memory.gitDirExists) {
    return result(
      'memory repo health',
      FAIL,
      'memory directory exists but its private git repo is missing — history lost, do not re-init blindly, see the using-zenno-memory skill'
    );
  }
  if (memory.gitDirExists && !memory.gitOk) {
    return result(
      'memory repo health',
      WARN,
      'memory git repo exists but git status failed inside it — history may be unreadable'
    );
  }
  return result('memory repo health', OK, 'memory directory and private git repo intact');
}

function checkInstallHealth({ marker, config, configErrors, memory }) {
  return [checkBootstrapMarker(marker), checkConfigValidity(config, configErrors), checkMemoryRepo(memory)];
}

// --- 2. External tools ----------------------------------------------------

function checkExternalTools({ tools }) {
  const checks = [];
  if (tools.rg) {
    checks.push(result('external tool: rg', OK, 'ripgrep found on PATH'));
  } else {
    checks.push(
      result(
        'external tool: rg',
        FAIL,
        'ripgrep (rg) not found on PATH — a hard dependency of secret scanning',
        'install it: pacman -S ripgrep / apt install ripgrep'
      )
    );
  }
  if (tools.ctags) {
    checks.push(result('external tool: ctags', OK, 'universal-ctags found on PATH'));
  } else {
    checks.push(
      result(
        'external tool: ctags',
        FAIL,
        'universal-ctags (ctags) not found on PATH — the repo-graph pipeline cannot regenerate without it',
        'install it: pacman -S universal-ctags / apt install universal-ctags'
      )
    );
  }
  return checks;
}

// --- 3. Broken references -------------------------------------------------

function checkBrokenReferences({ config, repoRoot, pathExists }) {
  const targetDir = config && config.traces ? config.traces.targetDir : undefined;
  if (!targetDir) {
    return [
      result(
        'config references resolve',
        WARN,
        'no targetDir configured — traces will not export'
      ),
    ];
  }
  const resolved = path.resolve(repoRoot, targetDir);
  if (pathExists(resolved)) {
    return [result('config references resolve', OK, `traces.targetDir resolves to ${resolved}`)];
  }
  return [
    result(
      'config references resolve',
      FAIL,
      `traces.targetDir points at ${resolved}, which does not resolve`,
      'set a valid traces.targetDir in zenno/config.json'
    ),
  ];
}

// --- 4. Config consistency ------------------------------------------------
// Reserved slot per design §12.3 ("contradictory settings flagged").
// Only concrete, known contradictions are checked — no invented ones.

function checkConfigConsistency({ config }) {
  const mode = config && config.traces ? config.traces.defaultMode : undefined;
  const targetDir = config && config.traces ? config.traces.targetDir : undefined;
  if (mode === 'otlp' && !targetDir) {
    return [
      result(
        'config consistency',
        WARN,
        'otlp mode selected but no targetDir — nothing will be exported'
      ),
    ];
  }
  return [result('config consistency', OK, 'no contradictory settings')];
}

// --- Summary + exit code --------------------------------------------------

function summarize(checkResults) {
  const summary = { total: checkResults.length, ok: 0, warn: 0, fail: 0 };
  for (const c of checkResults) {
    if (c.status === OK) summary.ok += 1;
    else if (c.status === WARN) summary.warn += 1;
    else if (c.status === FAIL) summary.fail += 1;
  }
  return summary;
}

function doctorExitCode(summary) {
  return summary.warn + summary.fail === 0 ? 0 : 1;
}

module.exports = {
  checkInstallHealth,
  checkExternalTools,
  checkBrokenReferences,
  checkConfigConsistency,
  summarize,
  doctorExitCode,
  STATUS: { OK, WARN, FAIL },
};
