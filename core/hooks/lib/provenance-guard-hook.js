#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { classifyInstallCommand } = require('./classify-install-command');
const { isInManifest } = require('./check-manifest');
const { detectTyposquat } = require('./detect-typosquat');
const { checkRegistryAge } = require('./check-registry-age');
const { appendJournalEntry } = require('./append-journal-entry');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Same fail-safe-to-protected direction as Confidential File Guard's
// config reader (Plan #4, Task 2): a missing or malformed config.json
// must not silently turn off global-install blocking, so the default
// here is true, not false.
function readBlockGlobalInstalls(repoRoot) {
  const configPath = path.join(repoRoot, 'zenno', 'config.json');
  if (!fs.existsSync(configPath)) return true;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config?.shield?.provenanceGuard?.blockGlobalInstalls ?? true;
  } catch {
    return true;
  }
}

async function evaluatePackage(packageName, ecosystem, repoRoot) {
  const alreadyDeclared = isInManifest(repoRoot, ecosystem, packageName);
  if (alreadyDeclared) {
    return { packageName, isNew: false, typosquat: null, registryAge: null };
  }

  const typosquat = detectTyposquat(packageName, ecosystem);
  const registryAge = await checkRegistryAge(packageName, ecosystem);

  return { packageName, isNew: true, typosquat, registryAge };
}

function formatBlockMessage(finding) {
  if (finding.typosquat?.isTyposquat) {
    return [
      `Zenno Provenance Guard: blocked — "${finding.packageName}" looks like a`,
      `typosquat of the well-known package "${finding.typosquat.suspectedRealPackage}"`,
      `(edit distance ${finding.typosquat.distance}). If this is genuinely the`,
      'package you want, install it manually outside this session, or add it',
      'to the manifest yourself first.',
    ].join(' ');
  }
  return null;
}

async function main() {
  const payload = readStdinJson();
  const command = payload.tool_input?.command || '';
  const cwd = payload.cwd || process.cwd();

  const install = classifyInstallCommand(command);
  if (install === null) {
    process.exit(0); // not a recognized package-manager install
  }

  if (install.isGlobal && readBlockGlobalInstalls(cwd)) {
    process.stderr.write(
      'Zenno Provenance Guard: blocked — global/system-wide installs are ' +
        'disabled by default. Set shield.provenanceGuard.blockGlobalInstalls ' +
        'to false in zenno/config.json to allow them.\n'
    );
    process.exit(2);
  }

  const findings = [];
  for (const packageName of install.packages) {
    const finding = await evaluatePackage(packageName, install.ecosystem, cwd);
    findings.push(finding);

    if (finding.isNew) {
      // Always logged, regardless of any other signal — this is the
      // exact case Auto Mode's own safe-list doesn't cover, since it only
      // carves out packages already declared in the manifest.
      appendJournalEntry(cwd, {
        type: 'new-dependency',
        ecosystem: install.ecosystem,
        package: packageName,
        typosquatSuspected: finding.typosquat?.isTyposquat ?? false,
        registryCheckOk: finding.registryAge?.checked ?? false,
        veryRecentlyPublished: finding.registryAge?.veryRecent ?? false,
      });
    }
  }

  const typosquatFinding = findings.find((f) => f.typosquat?.isTyposquat);
  if (typosquatFinding) {
    process.stderr.write(formatBlockMessage(typosquatFinding) + '\n');
    process.exit(2);
  }

  const recentFinding = findings.find((f) => f.registryAge?.veryRecent);
  if (recentFinding) {
    process.stderr.write(
      `Zenno Provenance Guard: warning — "${recentFinding.packageName}" was ` +
        'published very recently. Not blocked, but worth a second look before ' +
        'relying on it.\n'
    );
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { evaluatePackage, formatBlockMessage, readBlockGlobalInstalls };
