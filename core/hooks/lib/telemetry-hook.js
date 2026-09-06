#!/usr/bin/env node
const fs = require('node:fs');
const { readTelemetryConfig } = require('./telemetry-config');
const { generateTraceId, generateSpanId } = require('./otel-ids');
const { buildExecuteToolSpan } = require('./span-builder');
const { exportSpan } = require('./otlp-file-exporter');
const { syncJournalToTelemetry } = require('./journal-telemetry-bridge');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// PostToolUse hook: records a single-point execute_tool span for every
// tool call (no start/end pairing across separate hook invocations —
// deliberately sidesteps the same fundamental cross-invocation
// correlation problem Plan #7's Agent Team caps had to solve with a
// disclosed approximation; here, a point-in-time event is simpler and
// still genuinely useful for "what tools ran, when, how often"
// observability, at the cost of not capturing tool call duration).
// Also runs the journal-to-telemetry bridge on every call, so guard
// firings surface in the same telemetry stream without needing to
// retrofit any already-shipped Shield guard.
function main() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const config = readTelemetryConfig(cwd);

  if (!config.enabled) {
    process.exit(0); // off by default — the overwhelmingly common case, exit fast
  }

  const now = Date.now();
  const span = buildExecuteToolSpan({
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    toolName: payload.tool_name || 'unknown',
    startTime: now,
    endTime: now,
    recordContent: config.recordContent,
    toolInput: payload.tool_input,
  });
  exportSpan(cwd, span);

  syncJournalToTelemetry(cwd);

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {};
