#!/usr/bin/env node
// Plan 12 (Doctor/Health): SessionStart nudge — the three CHEAP check groups
// only (install health, registration existence, external tools — no
// subprocess-pair sanity, which costs ~10 node spawns). Prints to stdout
// ONLY when something is not OK; silent + exit 0 when all three groups pass.
// Same quiet-SessionStart pattern as graph-staleness-nudge-cli.js.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  checkInstallHealth,
  checkExternalTools,
  summarize,
  doctorExitCode,
} = require('./doctor-checks');
const { resolveHookPath } = require('./doctor-cli');

function readJsonFile(p) {
  try {
    return { value: JSON.parse(fs.readFileSync(p, 'utf8')), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
}

function runNudge(pluginRoot, repoRoot, homeDir) {
  const markerPath = path.join(repoRoot, 'zenno', '.initialized');
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  const hooksPath = path.join(pluginRoot, 'core', 'hooks', 'hooks.json');

  const marker = fs.existsSync(markerPath) ? readJsonFile(markerPath).value : null;
  const configRead = fs.existsSync(configPath) ? readJsonFile(configPath) : { value: null, error: null };

  // Memory: same derivation as doctor-cli.js (bootstrap-cli contract).
  // Kept in sync by construction — both derive from repoRoot + HOME.
  const slug = repoRoot.replace(/^[A-Za-z]:/, '').split(/[\\/]/).filter(Boolean).join('-');
  const snapshotsPath = path.join(homeDir, '.claude', 'projects', `-${slug}`, 'memory', 'zenno', 'snapshots');
  let memory = null;
  if (fs.existsSync(snapshotsPath)) {
    const gitDirExists = fs.existsSync(path.join(snapshotsPath, '.git'));
    memory = { snapshotsPath, rootExists: true, gitDirExists, gitOk: gitDirExists };
  }

  const toolStatus = (name) => spawnSync('which', [name], { encoding: 'utf8', timeout: 5000 }).status === 0;

  const all = [
    ...checkInstallHealth({ marker, config: configRead.value, configErrors: configRead.error, memory }),
    ...checkExternalTools({ tools: { rg: toolStatus('rg'), ctags: toolStatus('ctags') } }),
  ];

  // Registration existence only — no sanity subprocesses (too hot for every
  // SessionStart). Missing files are the only thing cheap to prove here.
  if (fs.existsSync(hooksPath)) {
    const hooksJson = readJsonFile(hooksPath).value || { hooks: {} };
    for (const [event, groups] of Object.entries(hooksJson.hooks || {})) {
      for (const group of groups) {
        for (const hook of group.hooks || []) {
          const hookPath = resolveHookPath(hook.command || '', pluginRoot);
          if (!hookPath) continue;
          const shortName = path.basename(hookPath);
          if (!fs.existsSync(hookPath)) {
            all.push({
              name: `hook registration: ${event}/${hook.matcher || '*'} → ${shortName}`,
              status: 'FAIL',
              detail: `hook file missing: ${hookPath}`,
            });
          }
        }
      }
    }
  }

  const summary = summarize(all);
  const problems = all.filter((c) => c.status !== 'OK');
  if (problems.length === 0) {
    return { output: '', exitCode: 0 };
  }
  const lines = problems.map((c) => `[${c.status === 'WARN' ? 'WARN' : 'FAIL'}] ${c.name} — ${c.detail}`);
  lines.push('run zenno doctor for details');
  return { output: lines.join('\n'), exitCode: doctorExitCode(summary) };
}

function main() {
  const pluginRoot =
    process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..', '..', '..');
  const repoRoot = process.cwd();
  const homeDir = process.env.HOME || process.env.USERPROFILE || require('node:os').homedir();
  const { output, exitCode } = runNudge(pluginRoot, repoRoot, homeDir);
  if (output) process.stdout.write(output + '\n');
  process.exitCode = exitCode;
}

if (require.main === module) {
  main();
}

module.exports = { runNudge };
