// Classifies a single config change as security-relevant or general,
// based on whether it WEAKENS a protection, not just whether it touches
// a security-adjacent field. Widening a deny list, tightening a cap, or
// disabling content recording are all changes too, but they make things
// MORE restrictive — only the weakening direction needs flagging, per
// the design spec's "flag any security-relevant change... before
// applying."
function isSecurityRelevant(change) {
  const { path, oldValue, newValue } = change;

  if (path === 'shield.confidentialFileGuard.denyPatterns') {
    const oldSet = new Set(oldValue || []);
    const newSet = new Set(newValue || []);
    return [...oldSet].some((v) => !newSet.has(v)); // removed patterns weaken protection
  }
  if (path === 'shield.confidentialFileGuard.allowPatterns') {
    const oldSet = new Set(oldValue || []);
    const newSet = new Set(newValue || []);
    return [...newSet].some((v) => !oldSet.has(v)); // additions widen what the guard lets through
  }
  if (path === 'shield.provenanceGuard.typosquatList') {
    const oldSet = new Set(oldValue || []);
    const newSet = new Set(newValue || []);
    return [...oldSet].some((v) => !newSet.has(v)); // removed packages lose typosquat protection
  }
  if (path === 'shield.provenanceGuard.blockGlobalInstalls') {
    return oldValue === true && newValue === false;
  }
  if (path === 'shield.secretScanner.allowlist') {
    const oldSet = new Set(oldValue || []);
    const newSet = new Set(newValue || []);
    return [...newSet].some((v) => !oldSet.has(v)); // additions weaken the scanner
  }
  if (['agentTeam.depthCap', 'agentTeam.concurrentCap', 'agentTeam.totalPerTaskCap'].includes(path)) {
    return typeof newValue === 'number' && typeof oldValue === 'number' && newValue > oldValue;
  }
  if (path === 'telemetry.recordContent') {
    return oldValue === false && newValue === true;
  }
  return false;
}

function classifyChanges(changes) {
  const securityRelevant = [];
  const general = [];
  for (const change of changes) {
    if (isSecurityRelevant(change)) securityRelevant.push(change);
    else general.push(change);
  }
  return { securityRelevant, general };
}

module.exports = { classifyChanges, isSecurityRelevant };
