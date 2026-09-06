const fs = require('node:fs');
const path = require('node:path');

function isInPackageJson(repoRoot, packageName) {
  const manifestPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(manifestPath)) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const deps = { ...manifest.dependencies, ...manifest.devDependencies };
    return Object.prototype.hasOwnProperty.call(deps, packageName);
  } catch {
    return false;
  }
}

function isInRequirementsTxt(repoRoot, packageName) {
  const manifestPath = path.join(repoRoot, 'requirements.txt');
  if (!fs.existsSync(manifestPath)) return false;
  const content = fs.readFileSync(manifestPath, 'utf8');
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}\\s*(==|>=|<=|~=|>|<|\\[|$)`, 'im');
  return pattern.test(content);
}

function isInCargoToml(repoRoot, packageName) {
  const manifestPath = path.join(repoRoot, 'Cargo.toml');
  if (!fs.existsSync(manifestPath)) return false;
  const content = fs.readFileSync(manifestPath, 'utf8');
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}\\s*=`, 'im');
  return pattern.test(content);
}

function isInManifest(repoRoot, ecosystem, packageName) {
  if (ecosystem === 'npm' || ecosystem === 'yarn' || ecosystem === 'pnpm') {
    return isInPackageJson(repoRoot, packageName);
  }
  if (ecosystem === 'pip') {
    return isInRequirementsTxt(repoRoot, packageName);
  }
  if (ecosystem === 'cargo') {
    return isInCargoToml(repoRoot, packageName);
  }
  return false;
}

module.exports = { isInManifest, isInPackageJson, isInRequirementsTxt, isInCargoToml };
