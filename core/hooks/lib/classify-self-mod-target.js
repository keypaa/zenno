const path = require('node:path');

// Hook-registration files are the single most dangerous self-mod target —
// per the design spec, unregistering a guard via these files is stealthier
// than editing a guard's own detection logic, since the guard's code still
// looks intact on inspection. Paths are relative to the PLUGIN root, not
// whatever repo is currently being worked in.
const SECURITY_CRITICAL_RELATIVE_PATHS = new Set([
  '.claude-plugin/plugin.json',
  'core/hooks/hooks.json',
]);

function isInsideDir(candidatePath, dirPath) {
  const rel = path.relative(dirPath, candidatePath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isUnderPluginHooksLogic(relativeToPlugin) {
  const normalized = relativeToPlugin.split(path.sep).join('/').toLowerCase();
  return normalized.startsWith('core/hooks/') && normalized.endsWith('.js');
}

// Returns 'security-critical', 'general', or 'not-applicable' (the path
// isn't inside the plugin or the target repo's canonical config file at
// all — not this guard's concern).
function classifySelfModTarget(filePath, pluginRoot, targetRepoRoot) {
  const resolved = path.resolve(filePath);

  // Checked first and independently of plugin-root nesting: if pluginRoot
  // and targetRepoRoot are the same directory (e.g. while developing
  // Zenno itself, working directly inside the plugin's own repo), the
  // plugin-nested branch below would otherwise short-circuit before ever
  // checking this, misclassifying zenno/config.json as merely "general."
  const relativeToTarget = path.relative(targetRepoRoot, resolved).split(path.sep).join('/');
  if (relativeToTarget.toLowerCase() === 'zenno/config.json') {
    return 'security-critical';
  }

  if (isInsideDir(resolved, pluginRoot)) {
    const relativeToPlugin = path.relative(pluginRoot, resolved);
    const normalized = relativeToPlugin.split(path.sep).join('/').toLowerCase();
    const securityCriticalLower = new Set(
      [...SECURITY_CRITICAL_RELATIVE_PATHS].map((p) => p.toLowerCase())
    );
    if (securityCriticalLower.has(normalized) || isUnderPluginHooksLogic(relativeToPlugin)) {
      return 'security-critical';
    }
    return 'general';
  }

  return 'not-applicable';
}

module.exports = { classifySelfModTarget, SECURITY_CRITICAL_RELATIVE_PATHS };
