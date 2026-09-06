#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { validateConfigSchema } = require('./config-schema');
const { diffConfigs } = require('./config-diff');
const { classifyChanges } = require('./security-relevant-change-detector');

function readCurrentConfig(repoRoot) {
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

// Never silently applies a security-relevant change — matches the design
// spec's "flag, never silently apply" requirement for config import,
// since this is a self-mod action on a Haruspex-Guard-protected file.
//
// Disclosed explicitly, not assumed: Haruspex Guard's own Bash-command
// pattern matching does not recognize "node config-import-cli.js" as a
// write-capable command (it only recognizes mv/rm/cp/tee/sed-i/
// redirects), so this CLI's own confirmation gate below is the ONLY
// safeguard on this path — not a backstop layered on top of Haruspex,
// since Haruspex structurally can't see inside what an arbitrary invoked
// script does internally.
function runConfigImport(repoRoot, sourcePath, options = {}) {
  if (!fs.existsSync(sourcePath)) {
    return { applied: false, reason: 'source-not-found' };
  }

  let importedConfig;
  try {
    importedConfig = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch {
    return { applied: false, reason: 'invalid-json' };
  }

  const schemaResult = validateConfigSchema(importedConfig);
  if (!schemaResult.valid) {
    return { applied: false, reason: 'invalid-schema', errors: schemaResult.errors };
  }

  const currentConfig = readCurrentConfig(repoRoot);
  const changes = diffConfigs(currentConfig, importedConfig);
  const { securityRelevant, general } = classifyChanges(changes);

  if (securityRelevant.length > 0 && !options.confirm) {
    return {
      applied: false,
      reason: 'security-relevant-changes-need-confirmation',
      securityRelevant,
      general,
    };
  }

  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(importedConfig, null, 2) + '\n', 'utf8');
  return { applied: true, securityRelevant, general };
}

function formatChangesReport(result) {
  const lines = [];
  if (result.securityRelevant?.length > 0) {
    lines.push('Security-relevant changes (require --confirm to apply):');
    for (const c of result.securityRelevant) {
      lines.push(`  - ${c.path}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.newValue)}`);
    }
  }
  if (result.general?.length > 0) {
    lines.push('Other changes:');
    for (const c of result.general) {
      lines.push(`  - ${c.path}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.newValue)}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const sourcePath = args.find((a) => !a.startsWith('--'));
  const confirm = args.includes('--confirm');
  const repoRoot = process.cwd();

  if (!sourcePath) {
    process.stderr.write('Usage: config-import-cli.js <path-to-config.json> [--confirm]\n');
    process.exit(1);
  }

  const result = runConfigImport(repoRoot, sourcePath, { confirm });

  if (!result.applied) {
    if (result.reason === 'security-relevant-changes-need-confirmation') {
      process.stdout.write(formatChangesReport(result) + '\n');
      process.stdout.write('\nRe-run with --confirm to apply these changes.\n');
      process.exit(1);
    }
    process.stderr.write(`Zenno: config import failed — ${result.reason}\n`);
    if (result.errors) process.stderr.write(result.errors.join('\n') + '\n');
    process.exit(1);
  }

  process.stdout.write('Zenno: config imported successfully.\n');
  if (result.securityRelevant.length > 0 || result.general.length > 0) {
    process.stdout.write(formatChangesReport(result) + '\n');
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { runConfigImport, formatChangesReport };
