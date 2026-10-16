/**
 * Zenno OpenCode V2 adapter (pure, testable).
 *
 * Maps V2 `permission.evaluate` events onto the V1 `permission.ask` shape
 * consumed by `handlePermissionAsk`, so all guard logic + tests stay intact.
 *
 * V2 evaluate event: { sessionID, agent?, action, resources[], metadata?, effect, message? }
 * V1 perm shape:     { type, pattern, sessionID, title, metadata } -> output { status, reason? }
 */
function evaluateToPerm(event) {
  const metadata = { ...(event?.metadata || {}) };
  if (event?.resources && metadata.resources === undefined) metadata.resources = event.resources;
  return {
    type: event?.action || "unknown",
    pattern: event?.resources || "",
    sessionID: event?.sessionID,
    title: event?.action || "",
    metadata,
  };
}

/**
 * Applies a V1 guard verdict to a V2 evaluate event.
 * Only DENY overrides the event — anything else leaves `effect` untouched
 * so the user's own ask/allow rules still apply (safer than V1, which forced allow).
 * Returns true when the event was denied.
 */
function applyGuardOutput(event, output) {
  if (output && output.status === "deny") {
    event.effect = "deny";
    if (output.reason) event.message = output.reason;
    return true;
  }
  return false;
}

module.exports = { evaluateToPerm, applyGuardOutput };
