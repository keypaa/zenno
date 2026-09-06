// Unlike the other three guards, this override is deliberately NOT a
// zenno/config.json field — that would be circular for a guard whose
// whole job is protecting config.json itself (an agent could edit the
// override flag and the config in the same breath). The override is a
// session-flag only: an environment variable the user sets themselves
// before starting the session, which an agent operating inside the
// session cannot retroactively set for itself in any way that takes
// effect this session.
const OVERRIDE_ENV_VAR = 'ZENNO_ALLOW_SELF_MOD';

function isOverrideActive(env = process.env) {
  return env[OVERRIDE_ENV_VAR] === '1';
}

module.exports = { isOverrideActive, OVERRIDE_ENV_VAR };
